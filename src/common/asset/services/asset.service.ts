import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { AwsS3Service } from '@common/aws/services/aws.s3.service';
import { EnumAwsS3Accessibility } from '@common/aws/enums/aws.enum';
import { FileService } from '@common/file/services/file.service';
import { HelperService } from '@common/helper/services/helper.service';
import { EnumAssetStatusCodeError } from '@common/asset/enums/asset.status-code.enum';
import {
    IAsset,
    IAssetCreateOptions,
    IAssetListOptions,
    IAssetUpdateMetadata,
    IAssetUploadInput,
} from '@common/asset/interfaces/asset.interface';
import { IAssetService } from '@common/asset/interfaces/asset.service.interface';
import { AssetRepository } from '@common/asset/repositories/asset.repository';
import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { EnumAssetAccess, EnumAssetStatus } from '@prisma/client';
import {
    AssetDefaultPath,
    AssetRandomLength,
} from '@common/asset/constants/asset.constant';

@Injectable()
export class AssetService implements IAssetService {
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

        const extension = this.resolveExtension(input.originalName);
        const filename = options?.filename?.trim() || input.originalName;
        const storageKey = this.createStorageKey(extension, options);

        try {
            const uploaded = await this.awsS3Service.putItem(
                {
                    key: storageKey,
                    size: input.size,
                    file: input.buffer,
                },
                {
                    access: mappedAccess,
                }
            );

            try {
                return await this.assetRepository.create({
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
                    createdBy,
                });
            } catch (createError: unknown) {
                try {
                    await this.awsS3Service.deleteItem(uploaded.key, {
                        access: mappedAccess,
                    });
                } catch (cleanupError: unknown) {
                    throw new InternalServerErrorException({
                        statusCode: EnumAppStatusCodeError.unknown,
                        message: 'http.serverError.internalServerError',
                        _error: { createError, cleanupError },
                    });
                }

                throw new InternalServerErrorException({
                    statusCode: EnumAppStatusCodeError.unknown,
                    message: 'http.serverError.internalServerError',
                    _error: { createError },
                });
            }
        } catch (err: unknown) {
            if (err instanceof InternalServerErrorException) {
                throw err;
            }

            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }
    }

    async getOne(assetId: string): Promise<IAsset> {
        const asset = await this.assetRepository.findOneById(assetId);
        if (!asset) {
            throw new NotFoundException({
                statusCode: EnumAssetStatusCodeError.notFound,
                message: 'asset.error.notFound',
            });
        }

        return asset;
    }

    async listByUploader(
        createdBy: string,
        options?: IAssetListOptions
    ): Promise<IAsset[]> {
        return this.assetRepository.findManyByUploader(
            createdBy,
            options?.includeDeleted ?? false
        );
    }

    async updateMetadata(
        assetId: string,
        metadata: IAssetUpdateMetadata,
        updatedBy: string
    ): Promise<IAsset> {
        const asset = await this.assetRepository.findOneActiveById(assetId);
        if (!asset) {
            throw new NotFoundException({
                statusCode: EnumAssetStatusCodeError.notFound,
                message: 'asset.error.notFound',
            });
        }

        const filename = metadata.filename?.trim();
        const checksum = metadata.checksum?.trim();

        if (filename === undefined && checksum === undefined) {
            return asset;
        }

        return this.assetRepository.update(asset.id, {
            filename,
            checksum,
            updatedBy,
        });
    }

    async delete(assetId: string, deletedBy: string): Promise<void> {
        const asset = await this.assetRepository.findOneById(assetId);
        if (!asset) {
            throw new NotFoundException({
                statusCode: EnumAssetStatusCodeError.notFound,
                message: 'asset.error.notFound',
            });
        }

        if (asset.status === EnumAssetStatus.deleted || asset.deletedAt) {
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
