import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    InjectDisk,
    StorageDisk,
    detectContentType,
    uploadToDisk,
} from '@nestjs/storage';
import type {
    StorageDownload,
    StorageFile,
    UploadStorageEngine,
} from '@nestjs/storage';
import Mime from 'mime';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { StorageContentTypeUtil } from '@common/storage/utils/storage.content-type.util';
import {
    StorageContentTypeSampleBytes,
    StorageDeleteBatchSize,
    StorageObjectKeyMaxLength,
    StorageObjectKeyRegex,
    StorageObjectKeyStructureInvalidRegex,
} from '@common/storage/constants/storage.constant';
import type {
    IStorageSignedDownload,
    IStorageSignedDownloadOptions,
    IStorageSignedUpload,
    IStorageSignedUploadOptions,
    IStorageTarget,
    IStorageVerifyRules,
    IStorageWriteBody,
    IStoredAsset,
    IStoredAssetReference,
    IStoredAssetSource,
} from '@common/storage/interfaces/storage.interface';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';

/**
 * The application's only surface onto object storage: URLs, signed transfers, upload verification,
 * deletion and health probes over the named `public` and `private` disks.
 */
@Injectable()
export class ObjectStorageService {
    private readonly logger = new Logger(ObjectStorageService.name);

    private readonly signedUploadExpiresInMs: number;
    private readonly signedDownloadExpiresInMs: number;
    private readonly probeTimeoutInMs: number;

    constructor(
        @InjectDisk(EnumStorageVisibility.public)
        private readonly publicDisk: StorageDisk,
        @InjectDisk(EnumStorageVisibility.private)
        private readonly privateDisk: StorageDisk,
        private readonly configService: ConfigService,
        private readonly databaseUtil: DatabaseUtil,
        private readonly storageErrorUtil: StorageErrorUtil,
        private readonly storageContentTypeUtil: StorageContentTypeUtil,
        private readonly helperDateService: HelperDateService
    ) {
        this.signedUploadExpiresInMs = this.configService.get<number>(
            'storage.signedUpload.expiresInMs'
        )!;
        this.signedDownloadExpiresInMs = this.configService.get<number>(
            'storage.signedDownload.expiresInMs'
        )!;
        this.probeTimeoutInMs = this.configService.get<number>(
            'storage.probeTimeoutInMs'
        )!;
    }

    private diskOf(visibility: EnumStorageVisibility): StorageDisk {
        if (visibility === EnumStorageVisibility.public) {
            return this.publicDisk;
        }

        return this.privateDisk;
    }

    private isValidKey(key: string): boolean {
        return (
            key.length <= StorageObjectKeyMaxLength &&
            StorageObjectKeyRegex.test(key) &&
            !StorageObjectKeyStructureInvalidRegex.test(key)
        );
    }

    private isValidScope(scopePrefix: string): boolean {
        if (!scopePrefix.endsWith('/')) {
            return false;
        }

        const scope = scopePrefix.slice(0, -1);
        const valid = this.isValidKey(scope);

        return valid;
    }

    private createKey(scopePrefix: string, contentType: string): string {
        const id = this.databaseUtil.createId();
        const extension = Mime.getExtension(contentType);
        if (!extension) {
            return `${scopePrefix}${id}`;
        }

        return `${scopePrefix}${id}.${extension}`;
    }

    private contentTypeEssence(contentType: string): string {
        return contentType.split(';')[0].trim().toLowerCase();
    }

    /** Logs the rejection, removes the rejected object and returns the exception for the caller to throw. */
    private async reject(
        key: string,
        reason: string,
        exception: AppBaseException
    ): Promise<AppBaseException> {
        this.logger.warn(`Rejected upload ${key}: ${reason}`);
        await this.deleteQuietly({
            key,
            visibility: EnumStorageVisibility.public,
        });

        return exception;
    }

    private async readHead(key: string, size: number): Promise<Buffer> {
        const length = Math.min(size, StorageContentTypeSampleBytes);
        const download: StorageDownload = await this.publicDisk.get(key, {
            range: { start: 0, end: length - 1 },
        });

        const chunks: Buffer[] = [];
        for await (const chunk of download.body) {
            chunks.push(Buffer.from(chunk as Uint8Array));
        }

        return Buffer.concat(chunks).subarray(0, length);
    }

    publicUrl(asset: IStoredAssetReference): string {
        if (asset.visibility !== EnumStorageVisibility.public) {
            throw new AppUnknownException(
                new Error('publicUrl() requires a public asset')
            );
        }

        return this.publicDisk.url(asset.key);
    }

    toAssetResponse(asset: IStoredAssetSource): StorageAssetResponseDto;
    toAssetResponse(
        asset: IStoredAssetSource | null
    ): StorageAssetResponseDto | null;
    toAssetResponse(
        asset: IStoredAssetSource | null
    ): StorageAssetResponseDto | null {
        if (!asset) {
            return null;
        }

        let url: string | null = null;
        if (asset.visibility === EnumStorageVisibility.public) {
            url = this.publicUrl(asset);
        }

        return {
            key: asset.key,
            visibility: asset.visibility,
            contentType: asset.contentType,
            url,
        };
    }

    async createSignedUpload(
        scopePrefix: string,
        { contentType, size }: IStorageSignedUploadOptions
    ): Promise<IStorageSignedUpload> {
        if (size < 1) {
            throw new StorageSizeInvalidException();
        }

        const validScope = this.isValidScope(scopePrefix);
        if (!validScope) {
            throw new StorageKeyInvalidException();
        }

        const key = this.createKey(scopePrefix, contentType);

        try {
            const signed = await this.publicDisk.signedUpload(key, {
                contentType,
                contentLength: size,
                expiresIn: this.signedUploadExpiresInMs,
            });

            return { key, ...signed };
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }
    }

    async signedDownload(
        asset: IStoredAssetReference,
        { filename, disposition }: IStorageSignedDownloadOptions
    ): Promise<IStorageSignedDownload> {
        const disk = this.diskOf(asset.visibility);
        const now = this.helperDateService.create();
        const lifetime = this.helperDateService.createDuration({
            milliseconds: this.signedDownloadExpiresInMs,
        });
        const expiresAt = this.helperDateService.forward(now, lifetime);

        try {
            await disk.stat(asset.key);
            const url = await disk.signedUrl(asset.key, {
                expiresIn: this.signedDownloadExpiresInMs,
                filename,
                disposition,
            });

            return { url, expiresAt };
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }
    }

    async verifyUpload(
        key: string,
        {
            scopePrefix,
            maxSizeInBytes,
            contentTypes,
            detect,
        }: IStorageVerifyRules
    ): Promise<IStoredAsset> {
        const validScope = this.isValidScope(scopePrefix);
        if (!validScope) {
            throw new StorageKeyInvalidException();
        }

        const valid = this.isValidKey(key);
        if (!valid || !key.startsWith(scopePrefix)) {
            throw new StorageKeyInvalidException();
        }

        let stat: StorageFile;
        try {
            stat = await this.publicDisk.stat(key);
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }

        if (stat.size === 0 || stat.size > maxSizeInBytes) {
            const exception = await this.reject(
                key,
                'invalid size',
                new StorageSizeInvalidException()
            );
            throw exception;
        }

        let head: Buffer;
        try {
            head = await this.readHead(key, stat.size);
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }

        let contentType = detectContentType(head) ?? null;
        if (!contentType && detect) {
            contentType = detect(new Uint8Array(head));
        }

        const allowed = contentTypes.map(type => this.contentTypeEssence(type));
        let accepted = false;
        if (contentType) {
            const essence = this.contentTypeEssence(contentType);
            accepted = allowed.includes(essence);

            const implied = this.storageContentTypeUtil.fromKey(key);
            if (accepted && implied) {
                accepted = this.contentTypeEssence(implied) === essence;
            }
        }

        if (!contentType || !accepted) {
            const exception = await this.reject(
                key,
                'invalid content type',
                new StorageContentTypeInvalidException()
            );
            throw exception;
        }

        return {
            key,
            visibility: EnumStorageVisibility.public,
            contentType,
            size: stat.size,
            etag: stat.etag ?? null,
        };
    }

    async store(
        target: IStorageTarget,
        { body, contentType }: IStorageWriteBody
    ): Promise<IStoredAsset> {
        const validScope = this.isValidScope(target.scopePrefix);
        if (!validScope) {
            throw new StorageKeyInvalidException();
        }

        const disk = this.diskOf(target.visibility);
        const key = this.createKey(target.scopePrefix, contentType);

        try {
            const written = await disk.put(key, body, {
                contentType,
                contentLength: body.length,
            });

            return {
                key,
                visibility: target.visibility,
                contentType: written.contentType,
                size: written.size,
                etag: written.etag ?? null,
            };
        } catch (error: unknown) {
            await this.deleteQuietly({ key, visibility: target.visibility });

            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }
    }

    createUploadEngine(
        target: IStorageTarget,
        contentTypes: readonly string[]
    ): UploadStorageEngine {
        const validScope = this.isValidScope(target.scopePrefix);
        if (!validScope) {
            throw new StorageKeyInvalidException();
        }

        const disk = this.diskOf(target.visibility);

        return uploadToDisk({
            disk,
            contentTypes: [...contentTypes],
            key: file => {
                const id = this.databaseUtil.createId();

                return `${target.scopePrefix}${id}${file.extension}`;
            },
        });
    }

    async delete(asset: IStoredAssetReference): Promise<void> {
        const disk = this.diskOf(asset.visibility);

        try {
            await disk.delete(asset.key);
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }
    }

    async deleteQuietly({
        key,
        visibility,
    }: IStoredAssetReference): Promise<void> {
        const disk = this.diskOf(visibility);

        try {
            await disk.delete(key);
        } catch (error: unknown) {
            this.logger.error(
                error,
                `Failed to delete ${visibility} storage object ${key}`
            );
        }
    }

    async deletePrefix(
        visibility: EnumStorageVisibility,
        prefix: string
    ): Promise<void> {
        if (prefix.length === 0) {
            throw new StorageKeyInvalidException();
        }

        const disk = this.diskOf(visibility);

        try {
            let batch: string[] = [];
            for await (const entry of disk.listAll({ prefix })) {
                batch.push(entry.key);
                if (batch.length === StorageDeleteBatchSize) {
                    await disk.delete(batch);
                    batch = [];
                }
            }

            if (batch.length > 0) {
                await disk.delete(batch);
            }
        } catch (error: unknown) {
            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        }
    }

    async probe(visibility: EnumStorageVisibility): Promise<void> {
        const disk = this.diskOf(visibility);
        const controller = new AbortController();
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                const exception = new StorageServiceUnavailableException(
                    new Error(`${visibility} storage probe timed out`)
                );
                controller.abort(exception);
                reject(exception);
            }, this.probeTimeoutInMs);
        });

        try {
            await Promise.race([
                disk.list({ limit: 1, signal: controller.signal }),
                timeout,
            ]);
        } catch (error: unknown) {
            if (error instanceof StorageServiceUnavailableException) {
                throw error;
            }

            const exception = this.storageErrorUtil.translate(error);
            throw exception;
        } finally {
            clearTimeout(timer);
        }
    }
}
