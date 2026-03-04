import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { AwsS3Service } from '@common/aws/services/aws.s3.service';
import { EnumAwsS3Accessibility } from '@common/aws/enums/aws.enum';
import { FileService } from '@common/file/services/file.service';
import { HelperService } from '@common/helper/services/helper.service';
import { EnumAssetStatusCodeError } from '@common/asset/enums/asset.status-code.enum';
import {
    IAsset,
    IAssetCreateOptions,
    IAssetUploadInput,
} from '@common/asset/interfaces/asset.interface';
import { IAssetService } from '@common/asset/interfaces/asset.service.interface';
import { AssetRepository } from '@common/asset/repositories/asset.repository';
import {
    IPaginationCursorReturn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { EnumAssetAccess, EnumAssetStatus, Prisma } from '@prisma/client';
import {
    AssetDefaultPath,
    AssetRandomLength,
} from '@common/asset/constants/asset.constant';

@Injectable()
export class AssetService implements IAssetService {
    private readonly logger = new Logger(AssetService.name);

    constructor(
        private readonly assetRepository: AssetRepository,
        private readonly awsS3Service: AwsS3Service,
        private readonly fileService: FileService,
        private readonly helperService: HelperService
    ) {}

    async upload(
        input: IAssetUploadInput,
        createdBy: string,
        options?: IAssetCreateOptions
    ): Promise<IAsset> {
        const access: EnumAssetAccess =
            options?.access ?? EnumAssetAccess.private;
        const mappedAccess =
            access === EnumAssetAccess.private
                ? EnumAwsS3Accessibility.private
                : EnumAwsS3Accessibility.public;

        //TODO: Shall we develop a whitelist/blacklist mechanism for extensions?
        const extension = this.resolveExtension(input.originalName);
        const filename = options?.filename?.trim() || input.originalName;
        const storageKey = this.createStorageKey(extension, options);

        let uploaded: Awaited<ReturnType<typeof this.awsS3Service.putItem>>;
        try {
            uploaded = await this.awsS3Service.putItem(
                { key: storageKey, size: input.size, file: input.buffer },
                { access: mappedAccess }
            );
        } catch (err: unknown) {
            this.logger.error(
                err,
                `Failed to upload asset to S3. StorageKey: ${storageKey}`
            );
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }

        // Persist asset — rollback S3 upload on failure
        try {
            return await this.assetRepository.create(
                {
                    storageKey: uploaded.key,
                    bucket: uploaded.bucket,
                    access,
                    filename,
                    completedUrl: uploaded.completedUrl,
                    cdnUrl: uploaded.cdnUrl,
                    mime: uploaded.mime,
                    extension: uploaded.extension,
                    size: uploaded.size,
                    checksum: options?.checksum?.trim(),
                    status: EnumAssetStatus.active,
                },
                createdBy
            );
        } catch (createError: unknown) {
            this.logger.error(
                createError,
                `Failed to persist asset to database. S3Key: ${uploaded.key}. Rolling back S3 upload.`
            );
            await this.awsS3Service
                .deleteItem(uploaded.key, { access: mappedAccess })
                .catch((cleanupError: unknown) => {
                    this.logger.error(
                        cleanupError,
                        `Failed to rollback S3 upload during asset creation failure. S3Key: ${uploaded.key}`
                    );
                    throw new InternalServerErrorException({
                        statusCode: EnumAppStatusCodeError.unknown,
                        message: 'http.serverError.internalServerError',
                        _error: { createError, cleanupError },
                    });
                });
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: createError,
            });
        }
    }

    async findOneByUploaderId(
        assetId: string,
        uploaderId: string
    ): Promise<IAsset> {
        const asset = await this.assetRepository.findOneByUploaderId(
            assetId,
            uploaderId
        );
        if (!asset) {
            throw new NotFoundException({
                statusCode: EnumAssetStatusCodeError.notFound,
                message: 'asset.error.notFound',
            });
        }

        return asset;
    }

    async findWithPaginationOffset(
        params: IPaginationQueryOffsetParams<
            Prisma.AssetSelect,
            Prisma.AssetWhereInput
        >
    ): Promise<IResponsePagingReturn<IAsset>> {
        return this.assetRepository.findWithPaginationOffset(params);
    }

    async findWithPaginationCursor(
        params: IPaginationQueryCursorParams<
            Prisma.AssetSelect,
            Prisma.AssetWhereInput
        >
    ): Promise<IPaginationCursorReturn<IAsset>> {
        return this.assetRepository.findWithPaginationCursor(params);
    }

    async delete(assetId: string, deletedBy: string): Promise<void> {
        const asset = await this.assetRepository.findOneByUploaderId(
            assetId,
            deletedBy
        );
        if (!asset) {
            throw new NotFoundException({
                statusCode: EnumAssetStatusCodeError.notFound,
                message: 'asset.error.notFound',
            });
        }

        if (asset.status === EnumAssetStatus.deleted) {
            return;
        }

        try {
            await this.awsS3Service.deleteItem(asset.storageKey, {
                access:
                    asset.access === EnumAssetAccess.private
                        ? EnumAwsS3Accessibility.private
                        : EnumAwsS3Accessibility.public,
            });

            await this.assetRepository.softDelete(asset.id, deletedBy);
        } catch (err: unknown) {
            this.logger.error(
                err,
                `Failed to delete asset. AssetId: ${asset.id}, S3Key: ${asset.storageKey}`
            );
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }
    }

    private resolveExtension(filename: string): string {
        const extension =
            this.fileService.extractExtensionFromFilename(filename);

        return extension && extension !== filename ? extension : 'bin';
    }

    private createStorageKey(
        extension: string,
        options?: Pick<IAssetCreateOptions, 'path' | 'prefix'>
    ): string {
        const normalizedPath = (options?.path?.trim() || AssetDefaultPath)
            .replaceAll(/\/+/g, '/')
            .replaceAll(/^\/+|\/+$/g, '');
        const normalizedPrefix = (options?.prefix?.trim() || '').replaceAll(
            /\s+/g,
            '-'
        );

        const token = this.helperService.randomString(AssetRandomLength);
        const filename = normalizedPrefix
            ? `${normalizedPrefix}-${token}.${extension}`
            : `${token}.${extension}`;

        return `${normalizedPath}/${filename}`;
    }
}
