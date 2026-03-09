import { DatabaseService } from '@common/database/services/database.service';
import {
    IAsset,
    IAssetCreate,
    IAssetUpdate,
} from '@common/asset/interfaces/asset.interface';
import {
    IPaginationCursorReturn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Injectable } from '@nestjs/common';
import { EnumAssetStatus } from '@prisma/client';

@Injectable()
export class AssetRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(data: IAssetCreate, createdBy: string): Promise<IAsset> {
        return this.databaseService.asset.create({
            data: {
                ...data,
                createdBy: createdBy,
            },
        });
    }

    async findOneById(assetId: string): Promise<IAsset | null> {
        return this.databaseService.asset.findUnique({
            where: {
                id: assetId,
            },
        });
    }

    async findOneByUploaderId(
        assetId: string,
        uploaderId: string
    ): Promise<IAsset | null> {
        return this.databaseService.asset.findFirst({
            where: {
                id: assetId,
                createdBy: uploaderId,
            },
        });
    }

    async findWithPaginationOffset({
        where,
        ...params
    }: IPaginationQueryOffsetParams): Promise<IResponsePagingReturn<IAsset>> {
        return this.paginationService.offset<IAsset>(
            this.databaseService.asset,
            {
                ...params,
                where: {
                    ...where,
                },
            }
        );
    }

    async findWithPaginationCursor({
        where,
        ...params
    }: IPaginationQueryCursorParams): Promise<IPaginationCursorReturn<IAsset>> {
        return this.paginationService.cursor<IAsset>(
            this.databaseService.asset,
            {
                ...params,
                where: {
                    ...where,
                },
            }
        );
    }

    async update(
        assetId: string,
        data: IAssetUpdate,
        updatedBy: string
    ): Promise<IAsset> {
        return this.databaseService.asset.update({
            where: {
                id: assetId,
            },
            data: {
                ...data,
                updatedBy,
            },
        });
    }

    async delete(assetId: string): Promise<IAsset> {
        return this.databaseService.asset.delete({
            where: {
                id: assetId,
            },
        });
    }
}
