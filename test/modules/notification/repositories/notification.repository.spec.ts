import { Test } from '@nestjs/testing';
import { mock, mockDeep } from 'vitest-mock-extended';
import { DatabaseService } from '@common/database/services/database.service';
import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { PaginationService } from '@common/pagination/services/pagination.service';
import {
    EnumNotificationChannel,
    EnumNotificationDeliveryStatus,
} from '@generated/prisma-client/client';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationRepository delivery state', () => {
    const databaseService = mockDeep<DatabaseService>();
    const transaction = mockDeep<IDatabaseTransactionClient>();
    const helperDateService = mock<HelperDateService>();
    const paginationService = mock<PaginationService>();
    const today = new Date('2026-11-08T12:00:00Z');
    const delivery = {
        id: 'delivery',
        notificationId: 'notification',
        channel: EnumNotificationChannel.push,
        status: EnumNotificationDeliveryStatus.processing,
        attempts: 1,
        lastError: null,
        sentAt: null,
        processedAt: null,
        failedAt: null,
        failureTokens: ['invalid-A'],
        createdAt: today,
        updatedAt: today,
        notification: { title: 'title', body: 'body' },
    };
    let repository: NotificationRepository;

    beforeEach(async () => {
        vi.resetAllMocks();
        helperDateService.create.mockReturnValue(today);
        databaseService.withTransaction.mockImplementation(
            async <T>(
                callback: (tx: IDatabaseTransactionClient) => Promise<T>
            ): Promise<T> => callback(transaction)
        );
        const module = await Test.createTestingModule({
            providers: [
                NotificationRepository,
                { provide: DatabaseService, useValue: databaseService },
                { provide: HelperDateService, useValue: helperDateService },
                { provide: PaginationService, useValue: paginationService },
            ],
        }).compile();
        repository = module.get(NotificationRepository);
    });

    it('claims only non-terminal rows owned by the user and returns persisted invalid tokens', async () => {
        transaction.notificationDelivery.updateMany.mockResolvedValue({
            count: 1,
        });
        transaction.notificationDelivery.findUnique.mockResolvedValue(delivery);
        expect(
            await repository.markProcessing(
                'user',
                'notification',
                EnumNotificationChannel.push
            )
        ).toEqual({
            title: 'title',
            body: 'body',
            failureTokens: ['invalid-A'],
        });
        expect(
            transaction.notificationDelivery.updateMany
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    notificationId: 'notification',
                    channel: EnumNotificationChannel.push,
                    status: {
                        notIn: [
                            EnumNotificationDeliveryStatus.sent,
                            EnumNotificationDeliveryStatus.failed,
                            EnumNotificationDeliveryStatus.skipped,
                        ],
                    },
                    notification: { is: { userId: 'user' } },
                },
                data: expect.objectContaining({
                    status: EnumNotificationDeliveryStatus.processing,
                    attempts: { increment: 1 },
                }),
            })
        );
    });

    it('returns null without reading content when no eligible row was claimed', async () => {
        transaction.notificationDelivery.updateMany.mockResolvedValue({
            count: 0,
        });
        expect(
            await repository.markProcessing(
                'user',
                'notification',
                EnumNotificationChannel.push
            )
        ).toBeNull();
        expect(
            transaction.notificationDelivery.findUnique
        ).not.toHaveBeenCalled();
    });

    it('clears stale failure state when a retry succeeds', async () => {
        await repository.markSent(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid-A']
        );
        expect(
            databaseService.client.notificationDelivery.update
        ).toHaveBeenCalledWith({
            where: {
                notificationId_channel: {
                    notificationId: 'notification',
                    channel: EnumNotificationChannel.push,
                },
                notification: { is: { userId: 'user' } },
            },
            data: {
                status: EnumNotificationDeliveryStatus.sent,
                failureTokens: ['invalid-A'],
                processedAt: today,
                sentAt: today,
                failedAt: null,
                lastError: null,
            },
        });
    });

    it('retains invalid tokens and reserves processedAt for terminal outcomes during retry', async () => {
        await repository.markRetry(
            'user',
            'notification',
            EnumNotificationChannel.push,
            'transient',
            ['invalid-A']
        );
        expect(
            databaseService.client.notificationDelivery.update
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    status: EnumNotificationDeliveryStatus.pending,
                    failureTokens: ['invalid-A'],
                    lastError: 'transient',
                    processedAt: null,
                    sentAt: null,
                    failedAt: null,
                },
            })
        );
    });

    it('marks exhausted delivery failed with no sent timestamp', async () => {
        await repository.markFailed(
            'user',
            'notification',
            EnumNotificationChannel.push,
            'exhausted',
            ['invalid-A']
        );
        expect(
            databaseService.client.notificationDelivery.update
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    status: EnumNotificationDeliveryStatus.failed,
                    failureTokens: ['invalid-A'],
                    lastError: 'exhausted',
                    processedAt: today,
                    sentAt: null,
                    failedAt: today,
                },
            })
        );
    });

    it('marks skipped without retaining a stale send or failure timestamp', async () => {
        await repository.markSkipped(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid-A']
        );
        expect(
            databaseService.client.notificationDelivery.update
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    status: EnumNotificationDeliveryStatus.skipped,
                    failureTokens: ['invalid-A'],
                    lastError: null,
                    processedAt: today,
                    sentAt: null,
                    failedAt: null,
                },
            })
        );
    });
});
