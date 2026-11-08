import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationSmsQueue } from '@modules/notification/queues/notification.sms.queue';
import { EnumQueue, EnumQueuePriority } from '@queues/enums/queue.enum';

describe('NotificationSmsQueue', () => {
    const notificationSmsQueue = mock<Queue>();
    const configService = mock<ConfigService>();
    let queue: NotificationSmsQueue;

    const payload: INotificationSendSmsPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        kind: EnumNotificationSmsProcess.changePassword,
        phoneNumbers: ['+628123456789', '+628987654321'],
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values: Record<string, unknown> = {
                'notification.dedupTtlInMs': 60_000,
            };

            return values[key];
        });
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsQueue,
                {
                    provide: getQueueToken(EnumQueue.notificationSms),
                    useValue: notificationSmsQueue,
                },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();
        queue = module.get(NotificationSmsQueue);
    });

    describe('sendSecurityAlert', () => {
        it('queue adds a job with no secret fields', async () => {
            await queue.sendSecurityAlert(payload);

            expect(notificationSmsQueue.add).toHaveBeenCalledWith(
                EnumNotificationSmsProcess.changePassword,
                {
                    userId: 'user-id',
                    notificationId: 'notification-id',
                    kind: EnumNotificationSmsProcess.changePassword,
                    phoneNumbers: ['+628123456789', '+628987654321'],
                },
                {
                    priority: EnumQueuePriority.high,
                    deduplication: {
                        id: `${EnumNotificationSmsProcess.changePassword}-${payload.userId}`,
                        ttl: 60_000,
                    },
                }
            );
        });
    });
});
