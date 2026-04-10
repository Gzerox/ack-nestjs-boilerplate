import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { TripAttachmentType, TripMediaKind } from '@generated/prisma-client';
import {
    ITripAttachmentWithAsset,
    ITripMediaWithAsset,
} from '@modules/trip/interfaces/trip.interface';

export interface ITripAssetInput {
    bucket: string;
    key: string;
    cdnUrl?: string | null;
    completedUrl: string;
    mime: string;
    extension: string;
    access: string;
    size: number;
}

export interface ITripMediaBatchCreateItem {
    asset: ITripAssetInput;
    tripId: string;
    createdBy: string;
    kind: TripMediaKind;
    caption?: string | null;
    calendarEventId?: string | null;
}

export interface ITripAttachmentBatchCreateItem {
    asset: ITripAssetInput;
    tripId: string;
    createdBy: string;
    title: string;
    type: TripAttachmentType;
    displayName?: string | null;
}

@Injectable()
export class TripAssetRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async deleteOrphanByTrip(tripId: string): Promise<void> {
        await this.databaseService.tripAsset.deleteMany({
            where: {
                tripId,
                media: { is: null },
                attachment: { is: null },
            },
        });
    }

    async createMediaBatch(
        items: ITripMediaBatchCreateItem[]
    ): Promise<ITripMediaWithAsset[]> {
        return this.databaseService.$transaction(async tx => {
            const results: ITripMediaWithAsset[] = [];
            for (const item of items) {
                const asset = await tx.tripAsset.create({
                    data: {
                        tripId: item.tripId,
                        bucket: item.asset.bucket,
                        key: item.asset.key,
                        cdnUrl: item.asset.cdnUrl ?? null,
                        completedUrl: item.asset.completedUrl,
                        mime: item.asset.mime,
                        extension: item.asset.extension,
                        access: item.asset.access,
                        size: item.asset.size,
                    },
                });
                const media = await tx.tripMedia.create({
                    data: {
                        tripId: item.tripId,
                        createdBy: item.createdBy,
                        kind: item.kind,
                        caption: item.caption ?? null,
                        calendarEventId: item.calendarEventId ?? null,
                        assetId: asset.id,
                    },
                    include: { asset: true },
                });
                results.push(media as ITripMediaWithAsset);
            }
            return results;
        });
    }

    async createAttachmentBatch(
        items: ITripAttachmentBatchCreateItem[]
    ): Promise<ITripAttachmentWithAsset[]> {
        return this.databaseService.$transaction(async tx => {
            const results: ITripAttachmentWithAsset[] = [];
            for (const item of items) {
                const asset = await tx.tripAsset.create({
                    data: {
                        tripId: item.tripId,
                        bucket: item.asset.bucket,
                        key: item.asset.key,
                        cdnUrl: item.asset.cdnUrl ?? null,
                        completedUrl: item.asset.completedUrl,
                        mime: item.asset.mime,
                        extension: item.asset.extension,
                        access: item.asset.access,
                        size: item.asset.size,
                    },
                });
                const attachment = await tx.tripAttachment.create({
                    data: {
                        tripId: item.tripId,
                        createdBy: item.createdBy,
                        title: item.title,
                        type: item.type,
                        displayName: item.displayName ?? null,
                        required: false,
                        assetId: asset.id,
                    },
                    include: { asset: true },
                });
                results.push(attachment as ITripAttachmentWithAsset);
            }
            return results;
        });
    }
}
