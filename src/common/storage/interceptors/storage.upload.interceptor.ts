import {
    HttpException,
    Injectable,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import type {
    CallHandler,
    ExecutionContext,
    NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { transformException } from '@nestjs/platform-express/multer/multer/multer.utils';
import type { StoredUpload } from '@nestjs/storage';
import type { Response } from 'express';
import Mime from 'mime';
import multer from 'multer';
import type { Observable } from 'rxjs';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import {
    StorageStoredUploadStoreKey,
    StorageUploadOptionsMetaKey,
} from '@common/storage/constants/storage.constant';
import { FileExtensionInvalidException } from '@common/file/exceptions/file.extension-invalid.exception';
import { FileRequiredException } from '@common/file/exceptions/file.required.exception';
import type {
    IStorageUploadSingleOptions,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import type { IRequestApp } from '@common/request/interfaces/request.interface';

/**
 * Streams the single multipart file a `StorageUploadSingle` route declares onto the disk for its visibility, after
 * byte-based type detection, and stores the resulting asset for `@StoredUpload()`.
 */
@Injectable()
export class StorageUploadInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
        private readonly objectStorageService: ObjectStorageService,
        private readonly storageErrorUtil: StorageErrorUtil,
        private readonly requestStoreService: RequestStoreService,
        private readonly helperStringService: HelperStringService
    ) {}

    private toPatternValues(request: IRequestApp): Record<string, string> {
        const entries = Object.entries(request.user ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
        );

        return Object.fromEntries(entries);
    }

    private mapError(error: unknown): unknown {
        if (error instanceof UnsupportedMediaTypeException) {
            return new FileExtensionInvalidException();
        }

        if (error instanceof HttpException) {
            return error;
        }

        const transformed: unknown = transformException(error as Error);
        if (transformed instanceof HttpException) {
            return transformed;
        }

        return this.storageErrorUtil.translate(error);
    }

    private toContentTypes(options: IStorageUploadSingleOptions): string[] {
        const contentTypes = options.extensions
            .map(extension => Mime.getType(extension))
            .filter(
                (contentType): contentType is string => contentType !== null
            );

        return [...new Set(contentTypes)];
    }

    async intercept(
        context: ExecutionContext,
        next: CallHandler
    ): Promise<Observable<unknown>> {
        const handler = context.getHandler();
        const options = this.reflector.get<IStorageUploadSingleOptions>(
            StorageUploadOptionsMetaKey,
            handler
        );
        const maxSizeInBytes = this.configService.get<number>(
            options.maxSizeInBytesConfigKey
        )!;
        const http = context.switchToHttp();
        const request = http.getRequest<IRequestApp>();
        const response = http.getResponse<Response>();

        const scopePrefixPattern = this.configService.get<string>(
            options.scopePrefixPatternConfigKey
        )!;
        const patternValues = this.toPatternValues(request);
        const scopePrefix = this.helperStringService.fillPattern(
            scopePrefixPattern,
            patternValues
        );
        const contentTypes = this.toContentTypes(options);
        const storage = this.objectStorageService.createUploadEngine(
            { visibility: options.visibility, scopePrefix },
            contentTypes
        );
        const upload = multer({
            storage,
            limits: { fileSize: maxSizeInBytes, files: 1 },
        }).single(options.fieldName);

        try {
            await new Promise<void>((resolve, reject) => {
                upload(request, response, (error: unknown) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        } catch (error: unknown) {
            const exception = this.mapError(error);
            throw exception;
        }

        const file = request.file as StoredUpload | undefined;
        if (!file) {
            throw new FileRequiredException();
        }

        const asset: IStoredAsset = {
            key: file.key,
            visibility: options.visibility,
            contentType: file.contentType,
            size: file.size,
            etag: file.etag ?? null,
        };
        this.requestStoreService.set(StorageStoredUploadStoreKey, asset);

        return next.handle();
    }
}
