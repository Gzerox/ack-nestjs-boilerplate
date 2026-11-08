import { Test } from '@nestjs/testing';
import { mock, mockDeep } from 'vitest-mock-extended';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { PaginationService } from '@common/pagination/services/pagination.service';
import {
    EnumNotificationChannel,
    EnumNotificationDeliveryStatus,
} from '@generated/prisma-client/client';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationRepository delivery state', () => {
    const databaseService = mockDeep<DatabaseService>();
    const helperDateService = mock<HelperDateService>();
    const paginationService = mock<PaginationService>();
    const today = new Date('2026-11-08T12:00:00Z');
    const delivery = {
        id: 'delivery',
        notificationId: 'notification',
        channel: EnumNotificationChannel.push,
        status: EnumNotificationDeliveryStatus.pending,
        lastError: null,
        sentAt: null,
        processedAt: null,
        failureTokens: ['invalid-A'],
        createdAt: today,
        updatedAt: today,
        notification: { title: 'title', body: 'body' },
    };
    let repository: NotificationRepository;

    beforeEach(async () => {
        vi.resetAllMocks();
        helperDateService.create.mockReturnValue(today);
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

    it('reads delivery states using complete recipient tuples', async () => {
        const contexts = [
            {
                userId: 'user-a',
                notificationId: 'notification-a',
                channel: EnumNotificationChannel.email,
            },
            {
                userId: 'user-b',
                notificationId: 'notification-b',
                channel: EnumNotificationChannel.push,
            },
        ];
        databaseService.client.notificationDelivery.findMany.mockResolvedValue([
            {
                notificationId: 'notification-a',
                channel: EnumNotificationChannel.email,
                status: EnumNotificationDeliveryStatus.failed,
                lastError: 'failure',
                notification: { userId: 'user-a' },
            },
        ] as never);
        expect(await repository.findDeliveryStates(contexts)).toEqual([
            {
                userId: 'user-a',
                notificationId: 'notification-a',
                channel: EnumNotificationChannel.email,
                status: EnumNotificationDeliveryStatus.failed,
                lastError: 'failure',
            },
        ]);
        expect(
            databaseService.client.notificationDelivery.findMany
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    OR: [
                        {
                            notificationId: 'notification-a',
                            channel: EnumNotificationChannel.email,
                            notification: { is: { userId: 'user-a' } },
                        },
                        {
                            notificationId: 'notification-b',
                            channel: EnumNotificationChannel.push,
                            notification: { is: { userId: 'user-b' } },
                        },
                    ],
                },
            })
        );
    });

    it('does not query all deliveries for an empty recipient list', async () => {
        expect(await repository.findDeliveryStates([])).toEqual([]);
        expect(
            databaseService.client.notificationDelivery.findMany
        ).not.toHaveBeenCalled();
    });

    describe('findForDelivery', () => {
        it('returns title, body and failureTokens for a non-terminal row owned by the user', async () => {
            databaseService.client.notificationDelivery.findUnique.mockResolvedValue(
                delivery
            );
            expect(
                await repository.findForDelivery(
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
                databaseService.client.notificationDelivery.findUnique
            ).toHaveBeenCalledTimes(1);
            expect(
                databaseService.client.notificationDelivery.findUnique
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        notificationId_channel: {
                            notificationId: 'notification',
                            channel: EnumNotificationChannel.push,
                        },
                        status: {
                            notIn: [
                                EnumNotificationDeliveryStatus.sent,
                                EnumNotificationDeliveryStatus.failed,
                                EnumNotificationDeliveryStatus.skipped,
                            ],
                        },
                        notification: { is: { userId: 'user' } },
                    },
                })
            );
        });

        it('returns null when no eligible row exists', async () => {
            databaseService.client.notificationDelivery.findUnique.mockResolvedValue(
                null
            );
            expect(
                await repository.findForDelivery(
                    'user',
                    'notification',
                    EnumNotificationChannel.push
                )
            ).toBeNull();
        });
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
                },
            })
        );
    });
});
