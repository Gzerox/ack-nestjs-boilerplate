import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationWhatsappQueue } from '@modules/notification/queues/notification.whatsapp.queue';
import { EnumQueue, EnumQueuePriority } from '@queues/enums/queue.enum';

describe('NotificationWhatsappQueue', () => {
    const notificationWhatsappQueue = mock<Queue>();
    const configService = mock<ConfigService>();
    let queue: NotificationWhatsappQueue;

    const verificationPayload: INotificationSendWhatsappVerificationPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        phoneNumber: '+628123456789',
        encryptedOtp: 'cipher-otp',
        expiredInMinutes: 5,
        languageCode: 'en',
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
                NotificationWhatsappQueue,
                {
                    provide: getQueueToken(EnumQueue.notificationWhatsapp),
                    useValue: notificationWhatsappQueue,
                },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();
        queue = module.get(NotificationWhatsappQueue);
    });

    describe('sendVerificationMobileNumber', () => {
        it('enqueues with high priority and notification-scoped dedup', async () => {
            await queue.sendVerificationMobileNumber(verificationPayload);

            expect(notificationWhatsappQueue.add).toHaveBeenCalledTimes(1);
            expect(notificationWhatsappQueue.add).toHaveBeenCalledWith(
                EnumNotificationWhatsappProcess.verificationMobileNumber,
                verificationPayload,
                {
                    priority: EnumQueuePriority.high,
                    deduplication: {
                        id: 'verificationMobileNumber-user-id-notification-id',
                        ttl: 60_000,
                    },
                }
            );
        });

        it('returns without add when phoneNumber is empty', async () => {
            await queue.sendVerificationMobileNumber({
                ...verificationPayload,
                phoneNumber: '',
            });

            expect(notificationWhatsappQueue.add).not.toHaveBeenCalled();
        });
    });
});
