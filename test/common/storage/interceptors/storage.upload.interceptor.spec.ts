import { PassThrough } from 'node:stream';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpException, PayloadTooLargeException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface.js';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import {
    InMemoryDisk,
    StorageServiceError,
    uploadToDisk,
} from '@nestjs/storage';
import { lastValueFrom, of, throwError } from 'rxjs';
import { multerExceptions } from '@nestjs/platform-express/multer/multer/multer.constants';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { StorageUploadInterceptor } from '@common/storage/interceptors/storage.upload.interceptor';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { StorageContentTypeUtil } from '@common/storage/utils/storage.content-type.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import {
    StorageStoredUploadStoreKey,
    StorageUploadOptionsMetaKey,
} from '@common/storage/constants/storage.constant';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { FileExtensionInvalidException } from '@common/file/exceptions/file.extension-invalid.exception';
import { FileRequiredException } from '@common/file/exceptions/file.required.exception';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import type { IStorageUploadSingleOptions } from '@common/storage/interfaces/storage.interface';
import type { IRequestApp } from '@common/request/interfaces/request.interface';

describe('StorageUploadInterceptor', () => {
    const boundary = 'storage-spec-boundary';
    const pngBytes = Buffer.concat([
        Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52,
        ]),
        Buffer.alloc(48, 1),
    ]);
    const options: IStorageUploadSingleOptions = {
        fieldName: 'photo',
        visibility: EnumStorageVisibility.public,
        scopePrefixPatternConfigKey: 'user.photo.scopePrefixPattern',
        maxSizeInBytesConfigKey: 'user.photo.maxSizeInBytes',
        extensions: [EnumFileExtensionImage.png, EnumFileExtensionImage.jpg],
    };

    const publicDisk = new InMemoryDisk();
    const reflector: MockProxy<Reflector> = mock<Reflector>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>();
    const configGet = vi.mocked(configService.get);
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const storageErrorUtil: MockProxy<StorageErrorUtil> =
        mock<StorageErrorUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const helperStringService: MockProxy<HelperStringService> =
        mock<HelperStringService>();
    let maxSizeInBytes = 1024;
    const next: MockProxy<CallHandler> = mock<CallHandler>();
    let interceptor: StorageUploadInterceptor;

    const createRequest = (
        parts: { field: string; filename: string | null; body: Buffer }[]
    ): IRequestApp => {
        const chunks = parts.flatMap(({ field, filename, body }) => {
            const disposition = filename
                ? `form-data; name="${field}"; filename="${filename}"`
                : `form-data; name="${field}"`;

            return [
                Buffer.from(
                    `--${boundary}\r\nContent-Disposition: ${disposition}\r\nContent-Type: image/png\r\n\r\n`
                ),
                body,
                Buffer.from('\r\n'),
            ];
        });
        const payload = Buffer.concat([
            ...chunks,
            Buffer.from(`--${boundary}--\r\n`),
        ]);
        const stream = new PassThrough();
        stream.end(payload);

        return Object.assign(stream, {
            headers: {
                'content-type': `multipart/form-data; boundary=${boundary}`,
                'content-length': String(payload.length),
            },
            user: { userId: 'user-1' },
        }) as unknown as IRequestApp;
    };

    const createContext = (request: IRequestApp): ExecutionContext => {
        const http = mock<HttpArgumentsHost>();
        http.getRequest.mockReturnValue(request);
        http.getResponse.mockReturnValue({});
        const context = mock<ExecutionContext>();
        context.switchToHttp.mockReturnValue(http);
        context.getHandler.mockReturnValue(() => undefined);

        return context;
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        publicDisk.clear();

        reflector.get.mockReturnValue(options);
        maxSizeInBytes = 1024;
        configGet.mockImplementation((key: string | symbol) => {
            if (key === 'user.photo.maxSizeInBytes') {
                return maxSizeInBytes;
            }

            if (key === 'user.photo.scopePrefixPattern') {
                return 'users/{userId}/profile/';
            }

            return undefined;
        });
        helperStringService.fillPattern.mockReturnValue(
            'users/user-1/profile/'
        );
        objectStorageService.createUploadEngine.mockImplementation(
            (target, contentTypes) =>
                uploadToDisk({
                    disk: publicDisk,
                    contentTypes: [...contentTypes],
                    key: file =>
                        `${target.scopePrefix}upload-1${file.extension}`,
                })
        );
        next.handle.mockReturnValue(of('handled'));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageUploadInterceptor,
                { provide: Reflector, useValue: reflector },
                { provide: ConfigService, useValue: configService },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
                { provide: StorageErrorUtil, useValue: storageErrorUtil },
                StorageContentTypeUtil,
                { provide: RequestStoreService, useValue: requestStoreService },
                { provide: HelperStringService, useValue: helperStringService },
            ],
        }).compile();

        interceptor = module.get(StorageUploadInterceptor);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('intercept', () => {
        it('streams a valid image to the disk for the route visibility and stores the asset for the handler', async () => {
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            const result = await lastValueFrom(
                await interceptor.intercept(context, next)
            );

            expect(result).toBe('handled');
            expect(reflector.get).toHaveBeenCalledWith(
                StorageUploadOptionsMetaKey,
                expect.any(Function)
            );
            expect(configGet).toHaveBeenCalledWith('user.photo.maxSizeInBytes');
            expect(configGet).toHaveBeenCalledWith(
                'user.photo.scopePrefixPattern'
            );
            expect(helperStringService.fillPattern).toHaveBeenCalledWith(
                'users/{userId}/profile/',
                { userId: 'user-1' }
            );
            expect(
                objectStorageService.createUploadEngine
            ).toHaveBeenCalledWith(
                {
                    visibility: EnumStorageVisibility.public,
                    scopePrefix: 'users/user-1/profile/',
                },
                ['image/png', 'image/jpeg']
            );
            const stat = await publicDisk.stat(
                'users/user-1/profile/upload-1.png'
            );
            expect(requestStoreService.set).toHaveBeenCalledWith(
                StorageStoredUploadStoreKey,
                {
                    key: 'users/user-1/profile/upload-1.png',
                    visibility: EnumStorageVisibility.public,
                    contentType: 'image/png',
                    size: pngBytes.length,
                    etag: stat.etag,
                }
            );
        });

        it('throws FileExtensionInvalidException for a .png-named file whose bytes are not an image and keeps nothing', async () => {
            const context = createContext(
                createRequest([
                    {
                        field: 'photo',
                        filename: 'photo.png',
                        body: Buffer.from('<html>not an image</html>'),
                    },
                ])
            );

            await expect(
                interceptor.intercept(context, next)
            ).rejects.toBeInstanceOf(FileExtensionInvalidException);
            expect(publicDisk.keys()).toEqual([]);
            expect(next.handle).not.toHaveBeenCalled();
            expect(requestStoreService.set).not.toHaveBeenCalled();
        });

        it('rejects a stream over the configured maximum with the size exception and keeps no partial object', async () => {
            maxSizeInBytes = 32;
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            await expect(
                interceptor.intercept(context, next)
            ).rejects.toBeInstanceOf(PayloadTooLargeException);
            expect(publicDisk.keys()).toEqual([]);
            expect(next.handle).not.toHaveBeenCalled();
        });

        it('rejects a file under another field name with the unexpected-field framework exception the file kit maps', async () => {
            const context = createContext(
                createRequest([
                    { field: 'avatar', filename: 'photo.png', body: pngBytes },
                ])
            );

            const rejection = interceptor.intercept(context, next);

            await expect(rejection).rejects.toBeInstanceOf(HttpException);
            await expect(rejection).rejects.toMatchObject({
                message: `${multerExceptions.LIMIT_UNEXPECTED_FILE} - avatar`,
            });
            expect(publicDisk.keys()).toEqual([]);
        });

        it('deletes the stored object quietly and rethrows when the handler fails after the write', async () => {
            const failure = new Error('handler failed');
            next.handle.mockReturnValue(throwError(() => failure));
            objectStorageService.deleteQuietly.mockResolvedValue();
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            const observable = await interceptor.intercept(context, next);

            await expect(lastValueFrom(observable)).rejects.toBe(failure);
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'users/user-1/profile/upload-1.png',
                    visibility: EnumStorageVisibility.public,
                })
            );
        });

        it('does not delete the stored object when the handler succeeds', async () => {
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            await lastValueFrom(await interceptor.intercept(context, next));

            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
        });

        it('throws FileRequiredException when the request carries no file', async () => {
            const context = createContext(
                createRequest([
                    {
                        field: 'note',
                        filename: null,
                        body: Buffer.from('no file here'),
                    },
                ])
            );

            await expect(
                interceptor.intercept(context, next)
            ).rejects.toBeInstanceOf(FileRequiredException);
            expect(next.handle).not.toHaveBeenCalled();
        });

        it('passes a framework exception the storage engine raises through unchanged', async () => {
            const exception = new PayloadTooLargeException('File too large');
            objectStorageService.createUploadEngine.mockReturnValue({
                _handleFile: (_req, _file, callback) => callback(exception),
                _removeFile: (_req, _file, callback) => callback(null),
            });
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            await expect(interceptor.intercept(context, next)).rejects.toBe(
                exception
            );
        });

        it('stores a null etag when the engine reports none', async () => {
            objectStorageService.createUploadEngine.mockReturnValue({
                _handleFile: (_req, file, callback) => {
                    file.stream.resume();
                    file.stream.on('end', () =>
                        callback(null, {
                            key: 'users/user-1/profile/upload-1.png',
                            size: 64,
                            contentType: 'image/png',
                        })
                    );
                },
                _removeFile: (_req, _file, callback) => callback(null),
            });
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            await lastValueFrom(await interceptor.intercept(context, next));

            expect(requestStoreService.set).toHaveBeenCalledWith(
                StorageStoredUploadStoreKey,
                expect.objectContaining({ etag: null })
            );
        });

        it('throws the translated exception when the disk refuses the write', async () => {
            const exception = new StorageServiceUnavailableException();
            storageErrorUtil.translate.mockReturnValue(exception);
            const error = new StorageServiceError({
                operation: 'put',
                code: 'AccessDenied',
            });
            vi.spyOn(publicDisk, 'put').mockRejectedValue(error);
            const context = createContext(
                createRequest([
                    { field: 'photo', filename: 'photo.png', body: pngBytes },
                ])
            );

            await expect(interceptor.intercept(context, next)).rejects.toBe(
                exception
            );
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(error);
        });
    });

    describe('toPatternValues', () => {
        it('passes only the userId of the authenticated user', () => {
            const request = Object.assign(createRequest([]), {
                user: {
                    userId: 'user-1',
                    sessionId: 'session-1',
                    loginAt: new Date('2026-01-01T00:00:00.000Z'),
                },
            });

            const result = interceptor['toPatternValues'](request);

            expect(result).toEqual({ userId: 'user-1' });
        });

        it('returns no value when the request carries no user', () => {
            const request = Object.assign(createRequest([]), {
                user: undefined,
            });

            const result = interceptor['toPatternValues'](request);

            expect(result).toEqual({});
        });
    });
});
