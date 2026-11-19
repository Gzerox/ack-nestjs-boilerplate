import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationRepository', () => {
    const create = vi.fn();
    const withTransaction = vi.fn();
    const databaseService = {
        client: { notification: { create } },
        withTransaction,
    };
    const helperDateService = mock<HelperDateService>();
    const paginationService = mock<PaginationService>();
    const today = new Date('2024-01-01T00:00:00.000Z');
    let repository: NotificationRepository;

    const base = {
        id: 'notification-id',
        userId: 'user-id',
        metadata: { username: 'nadia' },
        createdBy: 'user-id',
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        helperDateService.create.mockReturnValue(today);
        const module = await Test.createTestingModule({
            providers: [
                NotificationRepository,
                { provide: DatabaseService, useValue: databaseService },
                { provide: PaginationService, useValue: paginationService },
                { provide: HelperDateService, useValue: helperDateService },
            ],
        }).compile();
        repository = module.get(NotificationRepository);
    });

    describe('create', () => {
        it('creates the delivery rows from the contract pendingChannels', async () => {
            await repository.create(
                EnumNotificationKind.verificationMobileNumber,
                base
            );

            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    deliveries: {
                        createMany: {
                            data: [
                                { channel: EnumNotificationChannel.sms },
                                {
                                    channel: EnumNotificationChannel.silent,
                                    processedAt: today,
                                    sentAt: today,
                                },
                            ],
                        },
                    },
                }),
            });
        });
    });

    describe('createForChannels', () => {
        it('replaces the contract pendingChannels with the given channels and keeps deliveredChannels', async () => {
            await repository.createForChannels(
                EnumNotificationKind.verificationMobileNumber,
                base,
                [EnumNotificationChannel.whatsapp]
            );

            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    deliveries: {
                        createMany: {
                            data: [
                                { channel: EnumNotificationChannel.whatsapp },
                                {
                                    channel: EnumNotificationChannel.silent,
                                    processedAt: today,
                                    sentAt: today,
                                },
                            ],
                        },
                    },
                }),
            });
        });
    });

    describe('createMany', () => {
        it('creates each entry with its contract default channels', async () => {
            const txCreate = vi.fn().mockResolvedValue({ id: 'n' });
            withTransaction.mockImplementation(async callback =>
                callback({ notification: { create: txCreate } })
            );

            await repository.createMany([
                {
                    kind: EnumNotificationKind.verificationMobileNumber,
                    payload: base,
                },
            ]);

            expect(txCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    deliveries: {
                        createMany: {
                            data: [
                                { channel: EnumNotificationChannel.sms },
                                {
                                    channel: EnumNotificationChannel.silent,
                                    processedAt: today,
                                    sentAt: today,
                                },
                            ],
                        },
                    },
                }),
            });
        });
    });
});
