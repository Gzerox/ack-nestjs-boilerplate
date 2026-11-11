import { Readable } from 'node:stream';
import { Duration } from 'luxon';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import {
    InMemoryDisk,
    StorageFileNotFoundError,
    StorageInvalidKeyError,
    StorageServiceError,
    getDiskToken,
} from '@nestjs/storage';
import type { StoredUpload } from '@nestjs/storage';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import type {
    IStorageTarget,
    IStorageVerifyRules,
} from '@common/storage/interfaces/storage.interface';

describe('ObjectStorageService', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const signedUploadExpiresInMs = 600_000;
    const signedDownloadExpiresInMs = 300_000;
    const probeTimeoutInMs = 3000;
    const privateBaseUrl = 'https://api.example.com/api/storage/private';
    const signingKey = 'local-signing-key-0123456789abcdefghij';

    const pngBytes = Buffer.concat([
        Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52,
        ]),
        Buffer.alloc(48, 1),
    ]);

    const publicDisk = new InMemoryDisk({
        publicUrl: 'https://cdn.example.com',
        signedUrls: {
            baseUrl: 'https://api.example.com/api/storage/upload',
            keys: [signingKey],
        },
    });
    const privateDisk = new InMemoryDisk({
        signedUrls: { baseUrl: privateBaseUrl, keys: [signingKey] },
    });
    const configService: MockProxy<ConfigService> = mock<ConfigService>();
    const configGet = vi.mocked(configService.get);
    const databaseUtil: MockProxy<DatabaseUtil> = mock<DatabaseUtil>();
    const storageErrorUtil: MockProxy<StorageErrorUtil> =
        mock<StorageErrorUtil>();
    const helperDateService: MockProxy<HelperDateService> =
        mock<HelperDateService>();
    let service: ObjectStorageService;

    const photoRules: IStorageVerifyRules = {
        scopePrefix: 'users/user-1/profile/',
        maxSizeInBytes: 1024,
        contentTypes: ['image/png', 'image/jpeg'],
    };
    const stagedKey = 'users/user-1/profile/upload-1.png';

    beforeAll(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        vi.setSystemTime(now);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    beforeEach(async () => {
        vi.resetAllMocks();
        publicDisk.clear();
        privateDisk.clear();

        const config: Record<string, number> = {
            'storage.signedUpload.expiresInMs': signedUploadExpiresInMs,
            'storage.signedDownload.expiresInMs': signedDownloadExpiresInMs,
            'storage.probeTimeoutInMs': probeTimeoutInMs,
        };
        configGet.mockImplementation((key: string | symbol) =>
            typeof key === 'string' ? config[key] : undefined
        );
        helperDateService.create.mockReturnValue(now);
        helperDateService.createDuration.mockImplementation(duration =>
            Duration.fromObject(duration)
        );
        helperDateService.forward.mockImplementation(
            (date, duration) => new Date(date.getTime() + duration.toMillis())
        );
        let counter = 0;
        databaseUtil.createId.mockImplementation(() => {
            counter += 1;
            return `id-${counter}`;
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ObjectStorageService,
                {
                    provide: getDiskToken(EnumStorageVisibility.public),
                    useValue: publicDisk,
                },
                {
                    provide: getDiskToken(EnumStorageVisibility.private),
                    useValue: privateDisk,
                },
                { provide: ConfigService, useValue: configService },
                { provide: DatabaseUtil, useValue: databaseUtil },
                { provide: StorageErrorUtil, useValue: storageErrorUtil },
                { provide: HelperDateService, useValue: helperDateService },
            ],
        }).compile();

        service = module.get(ObjectStorageService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('publicUrl', () => {
        it('returns the public disk URL of a public asset', () => {
            const result = service.publicUrl({
                key: 'users/user-1/profile/photo.png',
                visibility: EnumStorageVisibility.public,
            });

            expect(result).toBe(
                'https://cdn.example.com/users/user-1/profile/photo.png'
            );
        });

        it('throws AppUnknownException for a private asset', () => {
            expect(() =>
                service.publicUrl({
                    key: 'term-policies/privacy/v1/en/content.hbs',
                    visibility: EnumStorageVisibility.private,
                })
            ).toThrow(AppUnknownException);
        });
    });

    describe('toAssetResponse', () => {
        it('resolves the url of a public asset and leaves the stored size and etag out', () => {
            const result = service.toAssetResponse({
                key: 'users/user-1/profile/photo.png',
                visibility: EnumStorageVisibility.public,
                contentType: 'image/png',
            });

            expect(result).toEqual({
                key: 'users/user-1/profile/photo.png',
                visibility: EnumStorageVisibility.public,
                contentType: 'image/png',
                url: 'https://cdn.example.com/users/user-1/profile/photo.png',
            });
        });

        it('returns null for an absent asset', () => {
            const result = service.toAssetResponse(null);

            expect(result).toBeNull();
        });

        it('returns a null url for a private asset', () => {
            const result = service.toAssetResponse({
                key: 'term-policies/privacy/v1/en/content.hbs',
                visibility: EnumStorageVisibility.private,
                contentType: 'text/x-handlebars-template',
            });

            expect(result).toEqual({
                key: 'term-policies/privacy/v1/en/content.hbs',
                visibility: EnumStorageVisibility.private,
                contentType: 'text/x-handlebars-template',
                url: null,
            });
        });

        it('keeps only the embedded fields when handed a full stored row', () => {
            const row: UserPhoto = {
                id: 'photo-1',
                userId: 'user-1',
                key: 'users/user-1/profile/photo.png',
                visibility: EnumStorageVisibility.public,
                contentType: 'image/png',
                size: 2048n,
                etag: '"etag-1"',
            };

            const result = service.toAssetResponse(row);

            expect(result).not.toHaveProperty('size');
            expect(result).not.toHaveProperty('etag');
        });
    });

    describe('createSignedUpload', () => {
        it('signs the final public key on the public disk', async () => {
            const sign = vi
                .spyOn(publicDisk, 'signedUpload')
                .mockResolvedValue({
                    url: 'https://storage.example.com/upload',
                    method: 'PUT',
                    headers: { 'content-type': 'image/png' },
                    expiresAt: now,
                });

            const result = await service.createSignedUpload(
                'users/user-1/profile/',
                { contentType: 'image/png', size: 2048 }
            );

            expect(result.key).toBe('users/user-1/profile/id-1.png');
            expect(sign).toHaveBeenCalledWith(result.key, expect.anything());
        });

        it('signs a PUT for a random key under the scope and pins the declared size', async () => {
            const result = await service.createSignedUpload(
                'users/user-1/profile/',
                { contentType: 'image/png', size: 2048 }
            );

            expect(result.key).toBe('users/user-1/profile/id-1.png');
            expect(result).toMatchObject({
                method: 'PUT',
                headers: { 'content-type': 'image/png' },
                expiresAt: new Date(now.getTime() + signedUploadExpiresInMs),
            });
            const claims = publicDisk.verifySignedUrl(result.url, 'PUT');
            expect(claims).toMatchObject({
                key: result.key,
                contentType: 'image/png',
                contentLength: 2048,
            });
        });

        it('draws a different key on every call', async () => {
            const first = await service.createSignedUpload(
                'users/user-1/profile/',
                { contentType: 'image/png', size: 10 }
            );
            const second = await service.createSignedUpload(
                'users/user-1/profile/',
                { contentType: 'image/png', size: 10 }
            );

            expect(first.key).not.toBe(second.key);
            expect(databaseUtil.createId).toHaveBeenCalledTimes(2);
        });

        it('writes nothing to either disk', async () => {
            await service.createSignedUpload('users/user-1/profile/', {
                contentType: 'image/png',
                size: 10,
            });

            expect(privateDisk.keys()).toEqual([]);
            expect(publicDisk.keys()).toEqual([]);
        });

        it.each([
            ['a parent segment', 'users/../admin/'],
            ['a leading slash', '/users/user-1/'],
            ['no trailing slash', 'users/user-1'],
            ['an empty scope', ''],
        ])(
            'throws StorageKeyInvalidException for a scope with %s',
            async (_label, scope) => {
                await expect(
                    service.createSignedUpload(scope, {
                        contentType: 'image/png',
                        size: 10,
                    })
                ).rejects.toMatchObject({
                    statusCode: EnumStorageStatusCodeError.keyInvalid,
                    messagePath: 'storage.error.keyInvalid',
                });
            }
        );

        it('translates a package failure', async () => {
            const exception = new StorageServiceUnavailableException();
            storageErrorUtil.translate.mockReturnValue(exception);
            const error = new StorageServiceError({
                operation: 'presign',
                code: 'NetworkError',
            });
            vi.spyOn(publicDisk, 'signedUpload').mockRejectedValue(error);

            await expect(
                service.createSignedUpload('users/user-1/profile/', {
                    contentType: 'image/png',
                    size: 10,
                })
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(error);
        });
    });

    describe('signedDownload', () => {
        it('signs a GET for an existing private object with the configured lifetime', async () => {
            await privateDisk.put(
                'term-policies/privacy/v1/en/content.hbs',
                '<p>hello</p>'
            );

            const result = await service.signedDownload(
                {
                    key: 'term-policies/privacy/v1/en/content.hbs',
                    visibility: EnumStorageVisibility.private,
                },
                { filename: 'privacy.hbs', disposition: 'attachment' }
            );

            expect(helperDateService.createDuration).toHaveBeenCalledWith({
                milliseconds: signedDownloadExpiresInMs,
            });
            expect(helperDateService.forward).toHaveBeenCalledWith(
                now,
                expect.any(Duration)
            );
            expect(result.expiresAt).toEqual(
                new Date(now.getTime() + signedDownloadExpiresInMs)
            );
            const claims = privateDisk.verifySignedUrl(result.url, 'GET');
            expect(claims.key).toBe('term-policies/privacy/v1/en/content.hbs');
            expect(claims.contentDisposition).toContain('privacy.hbs');
        });

        it('throws the translated not-found exception for a missing object', async () => {
            const exception = new StorageObjectNotFoundException();
            storageErrorUtil.translate.mockReturnValue(exception);

            await expect(
                service.signedDownload(
                    {
                        key: 'term-policies/privacy/v1/en/missing.hbs',
                        visibility: EnumStorageVisibility.private,
                    },
                    {}
                )
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(
                expect.any(StorageFileNotFoundError)
            );
        });
    });

    describe('verifyUpload', () => {
        it('returns the size, detected content type and etag of an allowed staged object', async () => {
            const written = await publicDisk.put(stagedKey, pngBytes, {
                contentType: 'image/jpeg',
            });

            const result = await service.verifyUpload(stagedKey, photoRules);

            expect(result).toEqual({
                key: stagedKey,
                visibility: EnumStorageVisibility.public,
                contentType: 'image/png',
                size: pngBytes.length,
                etag: written.etag,
            });
        });

        it.each([
            ['another user scope', 'users/user-2/profile/upload-1.png'],
            [
                'a parent segment',
                'users/user-1/profile/../../user-2/profile/upload-1.png',
            ],
            ['a leading slash', '/users/user-1/profile/upload-1.png'],
        ])(
            'throws StorageKeyInvalidException for %s without reading the object',
            async (_label, key) => {
                const stat = vi.spyOn(publicDisk, 'stat');
                const get = vi.spyOn(publicDisk, 'get');

                await expect(
                    service.verifyUpload(key, photoRules)
                ).rejects.toMatchObject({
                    statusCode: EnumStorageStatusCodeError.keyInvalid,
                    messagePath: 'storage.error.keyInvalid',
                });
                expect(stat).not.toHaveBeenCalled();
                expect(get).not.toHaveBeenCalled();
            }
        );

        it('throws the translated not-found exception when the staged object is missing', async () => {
            const exception = new StorageObjectNotFoundException();
            storageErrorUtil.translate.mockReturnValue(exception);

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(
                expect.any(StorageFileNotFoundError)
            );
        });

        it('throws StorageSizeInvalidException and deletes an object over the maximum size', async () => {
            await publicDisk.put(
                stagedKey,
                Buffer.concat([pngBytes, Buffer.alloc(2048)])
            );

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toBeInstanceOf(StorageSizeInvalidException);
            expect(publicDisk.keys()).toEqual([]);
        });

        it('throws StorageSizeInvalidException and deletes an empty object', async () => {
            await publicDisk.put(stagedKey, Buffer.alloc(0));

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toBeInstanceOf(StorageSizeInvalidException);
            expect(publicDisk.keys()).toEqual([]);
        });

        it('throws StorageContentTypeInvalidException and deletes an object whose bytes are not an allowed type', async () => {
            await publicDisk.put(stagedKey, '<html>not an image</html>', {
                contentType: 'image/png',
            });

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toMatchObject({
                statusCode: EnumStorageStatusCodeError.contentTypeInvalid,
                messagePath: 'storage.error.contentTypeInvalid',
            });
            expect(publicDisk.keys()).toEqual([]);
        });

        it('still throws the rejection when deleting the rejected object fails', async () => {
            await publicDisk.put(stagedKey, '<html>not an image</html>');
            vi.spyOn(publicDisk, 'delete').mockRejectedValue(
                new StorageServiceError({
                    operation: 'delete',
                    code: 'Timeout',
                })
            );

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toBeInstanceOf(StorageContentTypeInvalidException);
        });

        it('returns a null etag when the disk reports none', async () => {
            await publicDisk.put(stagedKey, pngBytes);
            vi.spyOn(publicDisk, 'stat').mockResolvedValue({
                key: stagedKey,
                size: pngBytes.length,
                contentType: 'image/png',
                lastModified: now,
                metadata: {},
            });

            const result = await service.verifyUpload(stagedKey, photoRules);

            expect(result.etag).toBeNull();
        });

        it('throws the translated exception when reading the first bytes fails', async () => {
            await publicDisk.put(stagedKey, pngBytes);
            const exception = new StorageServiceUnavailableException();
            storageErrorUtil.translate.mockReturnValue(exception);
            const error = new StorageServiceError({
                operation: 'get',
                code: 'Timeout',
            });
            vi.spyOn(publicDisk, 'get').mockRejectedValue(error);

            await expect(
                service.verifyUpload(stagedKey, photoRules)
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(error);
        });

        it('accepts a signature-less format through the feature detector', async () => {
            const templateKey = 'term-policies/privacy/v1/en/upload-1.hbs';
            await publicDisk.put(templateKey, '<p>{{name}}</p>');
            const detect = vi.fn((head: Uint8Array) =>
                head.includes(0) ? null : 'text/x-handlebars-template'
            );

            const result = await service.verifyUpload(templateKey, {
                scopePrefix: 'term-policies/privacy/v1/en/',
                maxSizeInBytes: 1024,
                contentTypes: ['text/x-handlebars-template'],
                detect,
            });

            expect(result.contentType).toBe('text/x-handlebars-template');
            expect(detect).toHaveBeenCalledWith(
                new Uint8Array(Buffer.from('<p>{{name}}</p>'))
            );
        });

        it('rejects a signature-less format the feature detector refuses', async () => {
            const templateKey = 'term-policies/privacy/v1/en/upload-1.hbs';
            await publicDisk.put(
                templateKey,
                Buffer.from([0x3c, 0x70, 0x00, 0x3e])
            );

            await expect(
                service.verifyUpload(templateKey, {
                    scopePrefix: 'term-policies/privacy/v1/en/',
                    maxSizeInBytes: 1024,
                    contentTypes: ['text/x-handlebars-template'],
                    detect: head =>
                        head.includes(0) ? null : 'text/x-handlebars-template',
                })
            ).rejects.toBeInstanceOf(StorageContentTypeInvalidException);
            expect(publicDisk.keys()).toEqual([]);
        });
    });

    describe('store', () => {
        const templateBytes = Buffer.from('<h1>{{title}}</h1>');

        it('writes the bytes under a new random key in the target scope and returns their metadata', async () => {
            const result = await service.store(
                {
                    visibility: EnumStorageVisibility.public,
                    scopePrefix: 'term-policies/privacy/v1/en/',
                },
                {
                    body: templateBytes,
                    contentType: 'text/x-handlebars-template',
                }
            );

            const stat = await publicDisk.stat(
                'term-policies/privacy/v1/en/id-1.hbs'
            );
            expect(result).toEqual({
                key: 'term-policies/privacy/v1/en/id-1.hbs',
                visibility: EnumStorageVisibility.public,
                contentType: 'text/x-handlebars-template',
                size: templateBytes.length,
                etag: stat.etag ?? null,
            });
            const stored = await publicDisk.getBuffer(
                'term-policies/privacy/v1/en/id-1.hbs'
            );
            expect(stored.equals(templateBytes)).toBe(true);
            expect(privateDisk.keys()).toEqual([]);
        });

        it('returns a null etag when the disk reports none', async () => {
            vi.spyOn(publicDisk, 'put').mockResolvedValue({
                key: 'term-policies/privacy/v1/en/id-1.hbs',
                size: templateBytes.length,
                contentType: 'text/x-handlebars-template',
                lastModified: now,
            } as Awaited<ReturnType<InMemoryDisk['put']>>);

            const result = await service.store(
                {
                    visibility: EnumStorageVisibility.public,
                    scopePrefix: 'term-policies/privacy/v1/en/',
                },
                {
                    body: templateBytes,
                    contentType: 'text/x-handlebars-template',
                }
            );

            expect(result.etag).toBeNull();
        });

        it('throws StorageKeyInvalidException without writing for an invalid scope', async () => {
            await expect(
                service.store(
                    {
                        visibility: EnumStorageVisibility.public,
                        scopePrefix: '../escape/',
                    },
                    {
                        body: templateBytes,
                        contentType: 'text/x-handlebars-template',
                    }
                )
            ).rejects.toBeInstanceOf(StorageKeyInvalidException);
            expect(publicDisk.keys()).toEqual([]);
        });

        it('translates a failed write and removes any partial object', async () => {
            const failure = new StorageServiceError({
                operation: 'put',
                code: 'NetworkError',
            });
            const translated = new StorageServiceUnavailableException();
            vi.spyOn(publicDisk, 'put').mockRejectedValue(failure);
            const deleteSpy = vi.spyOn(publicDisk, 'delete');
            storageErrorUtil.translate.mockReturnValue(translated);

            await expect(
                service.store(
                    {
                        visibility: EnumStorageVisibility.public,
                        scopePrefix: 'term-policies/privacy/v1/en/',
                    },
                    {
                        body: templateBytes,
                        contentType: 'text/x-handlebars-template',
                    }
                )
            ).rejects.toBe(translated);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(failure);
            expect(deleteSpy).toHaveBeenCalledWith(
                'term-policies/privacy/v1/en/id-1.hbs'
            );
        });
    });

    describe('createUploadEngine', () => {
        const target: IStorageTarget = {
            visibility: EnumStorageVisibility.public,
            scopePrefix: 'users/user-1/profile/',
        };

        const handleFile = (
            engine: ReturnType<ObjectStorageService['createUploadEngine']>,
            bytes: Buffer
        ): Promise<Partial<StoredUpload> | undefined> =>
            new Promise((resolve, reject) => {
                engine._handleFile(
                    {},
                    {
                        fieldname: 'photo',
                        originalname: 'photo.jpg',
                        mimetype: 'image/jpeg',
                        stream: Readable.from([bytes]),
                    },
                    (error, info) => (error ? reject(error) : resolve(info))
                );
            });

        it('streams an allowed file to a random key on the target disk with the extension of the detected type', async () => {
            const engine = service.createUploadEngine(target, [
                'image/png',
                'image/jpeg',
            ]);

            const info = await handleFile(engine, pngBytes);

            expect(info).toMatchObject({
                key: 'users/user-1/profile/id-1.png',
                contentType: 'image/png',
                size: pngBytes.length,
            });
            expect(publicDisk.keys()).toEqual([
                'users/user-1/profile/id-1.png',
            ]);
            expect(privateDisk.keys()).toEqual([]);
        });

        it('refuses a file whose bytes are not an allowed type and writes nothing', async () => {
            const engine = service.createUploadEngine(target, ['image/png']);

            await expect(
                handleFile(engine, Buffer.from('<html>not an image</html>'))
            ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
            expect(publicDisk.keys()).toEqual([]);
        });

        it('throws StorageKeyInvalidException for an invalid scope', () => {
            expect(() =>
                service.createUploadEngine(
                    { ...target, scopePrefix: 'users/../admin/' },
                    ['image/png']
                )
            ).toThrow(StorageKeyInvalidException);
        });
    });

    describe('delete', () => {
        it('removes the object from the disk named by its visibility', async () => {
            await publicDisk.put('users/user-1/profile/photo.png', pngBytes);
            await privateDisk.put('users/user-1/profile/photo.png', pngBytes);

            await service.delete({
                key: 'users/user-1/profile/photo.png',
                visibility: EnumStorageVisibility.public,
            });

            expect(publicDisk.keys()).toEqual([]);
            expect(privateDisk.keys()).toEqual([
                'users/user-1/profile/photo.png',
            ]);
        });

        it('resolves when the object is already missing', async () => {
            await expect(
                service.delete({
                    key: 'users/user-1/profile/missing.png',
                    visibility: EnumStorageVisibility.public,
                })
            ).resolves.toBeUndefined();
        });

        it('throws the translated exception when the disk fails', async () => {
            const exception = new StorageServiceUnavailableException();
            storageErrorUtil.translate.mockReturnValue(exception);
            vi.spyOn(publicDisk, 'delete').mockRejectedValue(
                new StorageServiceError({
                    operation: 'delete',
                    code: 'Timeout',
                })
            );

            await expect(
                service.delete({
                    key: 'users/user-1/profile/photo.png',
                    visibility: EnumStorageVisibility.public,
                })
            ).rejects.toBe(exception);
        });
    });

    describe('deletePrefix', () => {
        it('removes every object under the prefix across listing pages and nothing else', async () => {
            const keys = Array.from(
                { length: 1001 },
                (_value, index) =>
                    `term-policies/privacy/v1/en/object-${index}.hbs`
            );
            await Promise.all(keys.map(key => privateDisk.put(key, 'x')));
            await privateDisk.put('term-policies/privacy/v2/en/keep.hbs', 'x');

            await service.deletePrefix(
                EnumStorageVisibility.private,
                'term-policies/privacy/v1/'
            );

            expect(privateDisk.keys()).toEqual([
                'term-policies/privacy/v2/en/keep.hbs',
            ]);
        });

        it('resolves without deleting when nothing is under the prefix', async () => {
            const remove = vi.spyOn(privateDisk, 'delete');

            await service.deletePrefix(
                EnumStorageVisibility.private,
                'term-policies/privacy/v9/'
            );

            expect(remove).not.toHaveBeenCalled();
        });

        it('throws StorageKeyInvalidException for an empty prefix without listing', async () => {
            const list = vi.spyOn(privateDisk, 'list');

            await expect(
                service.deletePrefix(EnumStorageVisibility.private, '')
            ).rejects.toBeInstanceOf(StorageKeyInvalidException);
            expect(list).not.toHaveBeenCalled();
        });

        it('throws the translated exception for a prefix the disk refuses', async () => {
            const exception = new StorageKeyInvalidException();
            storageErrorUtil.translate.mockReturnValue(exception);

            await expect(
                service.deletePrefix(
                    EnumStorageVisibility.private,
                    '../escape/'
                )
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(
                expect.any(StorageInvalidKeyError)
            );
        });
    });

    describe('probe', () => {
        it('resolves when the disk answers a one-entry listing', async () => {
            const list = vi.spyOn(publicDisk, 'list');

            await expect(
                service.probe(EnumStorageVisibility.public)
            ).resolves.toBeUndefined();
            expect(list).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 1,
                    signal: expect.any(AbortSignal),
                })
            );
        });

        it('rejects with StorageServiceUnavailableException when the listing hangs past the timeout', async () => {
            vi.spyOn(privateDisk, 'list').mockReturnValue(
                new Promise(() => undefined)
            );

            const assertion = expect(
                service.probe(EnumStorageVisibility.private)
            ).rejects.toMatchObject({
                statusCode: EnumStorageStatusCodeError.serviceUnavailable,
                messagePath: 'storage.error.serviceUnavailable',
            });
            await vi.advanceTimersByTimeAsync(probeTimeoutInMs);

            await assertion;
        });

        it('throws the translated exception when the listing fails', async () => {
            const exception = new StorageServiceUnavailableException();
            storageErrorUtil.translate.mockReturnValue(exception);
            const error = new StorageServiceError({
                operation: 'list',
                code: 'AccessDenied',
            });
            vi.spyOn(privateDisk, 'list').mockRejectedValue(error);

            await expect(
                service.probe(EnumStorageVisibility.private)
            ).rejects.toBe(exception);
            expect(storageErrorUtil.translate).toHaveBeenCalledWith(error);
        });
    });
});
