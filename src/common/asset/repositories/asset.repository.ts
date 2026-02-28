import { DatabaseService } from '@common/database/services/database.service';
import { HelperService } from '@common/helper/services/helper.service';
import {
    IAsset,
    IAssetCreate,
    IAssetUpdate,
} from '@common/asset/interfaces/asset.interface';
import { Injectable } from '@nestjs/common';
import { EnumAssetStatus } from '@prisma/client';

@Injectable()
export class AssetRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly helperService: HelperService
    ) {}

    async create(data: IAssetCreate): Promise<IAsset> {
        return this.databaseService.asset.create({
            data: {
                ...data,
                deletedAt: null,
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

    async findOneActiveById(assetId: string): Promise<IAsset | null> {
        return this.databaseService.asset.findFirst({
            where: {
                id: assetId,
                status: EnumAssetStatus.active,
                deletedAt: null,
            },
        });
    }

    async findManyByUploader(
        createdBy: string,
        includeDeleted: boolean = false
    ): Promise<IAsset[]> {
        return this.databaseService.asset.findMany({
            where: {
                createdBy,
                ...(includeDeleted
                    ? {}
                    : {
                          status: EnumAssetStatus.active,
                          deletedAt: null,
                      }),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async update(assetId: string, data: IAssetUpdate): Promise<IAsset> {
        return this.databaseService.asset.update({
            where: {
                id: assetId,
            },
            data,
        });
    }

    async softDelete(assetId: string, deletedBy: string): Promise<IAsset> {
        const deletedAt = this.helperService.dateCreate();
        return this.databaseService.asset.update({
            where: {
                id: assetId,
            },
            data: {
                status: EnumAssetStatus.deleted,
                deletedAt,
                deletedBy,
                updatedBy: deletedBy,
            },
        });
    }
}
