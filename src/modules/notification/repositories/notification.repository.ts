import { DatabaseService } from '@common/database/services/database.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import type { IPaginationQueryCursorParams } from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import { NotificationKindContract } from '@modules/notification/contracts/notification.kind.contract';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import type {
    INotificationContent,
    INotificationCreate,
    INotificationCreateEntry,
    INotificationDeliveryContext,
    INotificationDeliveryState,
} from '@modules/notification/interfaces/notification.interface';
import type { INotificationRepository } from '@modules/notification/interfaces/notification.repository.interface';
import { Injectable } from '@nestjs/common';
import {
    EnumNotificationChannel,
    EnumNotificationDeliveryStatus,
    Prisma,
} from '@generated/prisma-client/client';
import type { Notification } from '@generated/prisma-client/client';

@Injectable()
export class NotificationRepository implements INotificationRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly helperDateService: HelperDateService
    ) {}

    private buildCreateData(
        kind: EnumNotificationKind,
        { id, userId, metadata, createdBy }: INotificationCreate,
        today: Date
    ): Prisma.NotificationUncheckedCreateInput {
        const {
            type,
            priority,
            title,
            body,
            pendingChannels,
            deliveredChannels,
        } = NotificationKindContract[kind];

        return {
            id,
            type,
            title,
            body,
            userId,
            metadata,
            isRead: false,
            priority,
            createdBy,
            deliveries: {
                createMany: {
                    data: [
                        ...pendingChannels.map(channel => ({
                            channel,
                            status: EnumNotificationDeliveryStatus.pending,
                        })),
                        ...deliveredChannels.map(channel => ({
                            channel,
                            status: EnumNotificationDeliveryStatus.sent,
                            processedAt: today,
                            sentAt: today,
                        })),
                    ],
                },
            },
        };
    }

    async findDeliveryStates(
        contexts: INotificationDeliveryContext[]
    ): Promise<INotificationDeliveryState[]> {
        if (contexts.length === 0) {
            return [];
        }

        const deliveries =
            await this.databaseService.client.notificationDelivery.findMany({
                where: {
                    OR: contexts.map(({ userId, notificationId, channel }) => ({
                        notificationId,
                        channel,
                        notification: { is: { userId } },
                    })),
                },
                select: {
                    notificationId: true,
                    channel: true,
                    status: true,
                    lastError: true,
                    notification: { select: { userId: true } },
                },
            });
        return deliveries.map(({ notification, ...delivery }) => ({
            ...delivery,
            userId: notification.userId,
        }));
    }

    async findWithPaginationCursor(
        userId: string,
        {
            where,
            ...params
        }: IPaginationQueryCursorParams<Prisma.NotificationWhereInput>
    ): Promise<IResponsePaginationReturn<Notification>> {
        return this.paginationService.cursor<
            Notification,
            Prisma.NotificationWhereInput
        >(this.databaseService.client.notification, {
            ...params,
            where: {
                ...where,
                userId,
            },
        });
    }

    async findIsReadById(
        userId: string,
        notificationId: string
    ): Promise<{ isRead: boolean } | null> {
        return this.databaseService.client.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
            select: { isRead: true },
        });
    }

    async create(
        kind: EnumNotificationKind,
        payload: INotificationCreate
    ): Promise<Notification> {
        const today = this.helperDateService.create();

        const createData = this.buildCreateData(kind, payload, today);

        return this.databaseService.client.notification.create({
            data: createData,
        });
    }

    async createMany(
        entries: INotificationCreateEntry[]
    ): Promise<Notification[]> {
        const today = this.helperDateService.create();

        return this.databaseService.withTransaction(async tx => {
            const created: Notification[] = [];
            for (const { kind, payload } of entries) {
                const createData = this.buildCreateData(kind, payload, today);
                const row = await tx.notification.create({
                    data: createData,
                });
                created.push(row);
            }

            return created;
        });
    }

    async markAsRead(
        userId: string,
        notificationId: string
    ): Promise<Notification> {
        const readAt = this.helperDateService.create();

        return this.databaseService.client.notification.update({
            where: {
                id: notificationId,
                userId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt,
            },
        });
    }

    async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
        const readAt = this.helperDateService.create();

        return this.databaseService.client.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt,
            },
        });
    }

    async markProcessing(
        userId: string,
        notificationId: string,
        channel: EnumNotificationChannel
    ): Promise<INotificationContent | null> {
        return this.databaseService.withTransaction(async tx => {
            // Sequential by design: statements on one tx, and the read depends on the claim.
            const { count } = await tx.notificationDelivery.updateMany({
                where: {
                    notificationId,
                    channel,
                    status: {
                        notIn: [
                            EnumNotificationDeliveryStatus.sent,
                            EnumNotificationDeliveryStatus.failed,
                            EnumNotificationDeliveryStatus.skipped,
                        ],
                    },
                    notification: { is: { userId } },
                },
                data: {
                    status: EnumNotificationDeliveryStatus.processing,
                    attempts: { increment: 1 },
                    processedAt: null,
                    sentAt: null,
                    failedAt: null,
                },
            });
            if (count === 0) {
                return null;
            }

            const delivery = await tx.notificationDelivery.findUnique({
                where: {
                    notificationId_channel: { notificationId, channel },
                    notification: { is: { userId } },
                },
                select: {
                    failureTokens: true,
                    notification: { select: { title: true, body: true } },
                },
            });
            return delivery
                ? {
                      ...delivery.notification,
                      failureTokens: delivery.failureTokens,
                  }
                : null;
        });
    }

    async markSent(
        userId: string,
        notificationId: string,
        channel: EnumNotificationChannel,
        failureTokens: string[]
    ): Promise<void> {
        const today = this.helperDateService.create();
        await this.databaseService.client.notificationDelivery.update({
            where: {
                notificationId_channel: { notificationId, channel },
                notification: { is: { userId } },
            },
            data: {
                status: EnumNotificationDeliveryStatus.sent,
                failureTokens,
                processedAt: today,
                sentAt: today,
                failedAt: null,
                lastError: null,
            },
        });
    }

    async markFailed(
        userId: string,
        notificationId: string,
        channel: EnumNotificationChannel,
        error: string,
        failureTokens: string[]
    ): Promise<void> {
        const today = this.helperDateService.create();
        await this.databaseService.client.notificationDelivery.update({
            where: {
                notificationId_channel: { notificationId, channel },
                notification: { is: { userId } },
            },
            data: {
                status: EnumNotificationDeliveryStatus.failed,
                lastError: error,
                failureTokens,
                processedAt: today,
                failedAt: today,
                sentAt: null,
            },
        });
    }

    async markRetry(
        userId: string,
        notificationId: string,
        channel: EnumNotificationChannel,
        error: string,
        failureTokens: string[]
    ): Promise<void> {
        await this.databaseService.client.notificationDelivery.update({
            where: {
                notificationId_channel: { notificationId, channel },
                notification: { is: { userId } },
            },
            data: {
                status: EnumNotificationDeliveryStatus.pending,
                lastError: error,
                failureTokens,
                processedAt: null,
                sentAt: null,
                failedAt: null,
            },
        });
    }

    async markSkipped(
        userId: string,
        notificationId: string,
        channel: EnumNotificationChannel,
        failureTokens: string[]
    ): Promise<void> {
        const today = this.helperDateService.create();
        await this.databaseService.client.notificationDelivery.update({
            where: {
                notificationId_channel: { notificationId, channel },
                notification: { is: { userId } },
            },
            data: {
                status: EnumNotificationDeliveryStatus.skipped,
                failureTokens,
                processedAt: today,
                sentAt: null,
                failedAt: null,
                lastError: null,
            },
        });
    }
}
