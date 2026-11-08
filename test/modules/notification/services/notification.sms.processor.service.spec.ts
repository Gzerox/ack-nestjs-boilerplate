import type { INotificationDeliveryAttempt } from '@modules/notification/interfaces/notification.interface';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { NotificationSmsSecurityDomain } from '@modules/notification/domains/notification.sms.security.domain';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationSmsProcessorService } from '@modules/notification/services/notification.sms.processor.service';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationSmsProcessorService', () => {
    const notificationSmsSecurityDomain = mock<NotificationSmsSecurityDomain>();
    let service: NotificationSmsProcessorService;

    const completedAttempt: INotificationDeliveryAttempt = {
        outcome: 'completed',
        summary: {
            acceptedCount: 1,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        },
    };

    const payload: INotificationSendSmsPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        kind: EnumNotificationSmsProcess.newDeviceLogin,
        phoneNumbers: ['+628123456789'],
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsProcessorService,
                {
                    provide: NotificationSmsSecurityDomain,
                    useValue: notificationSmsSecurityDomain,
                },
            ],
        }).compile();
        service = module.get(NotificationSmsProcessorService);
    });

    it('narrows zero-success retry data to transient numbers and preserves the payload', async () => {
        const job =
            mock<
                Job<
                    INotificationSendSmsPayload,
                    IQueueResponse,
                    EnumNotificationSmsProcess
                >
            >();
        job.opts = { attempts: 3 };
        job.data = { ...payload, phoneNumbers: ['+111', '+222'] };
        notificationSmsSecurityDomain.process.mockResolvedValue({
            outcome: 'retry',
            summary: {
                acceptedCount: 0,
                failedCount: 2,
                invalidTargetCount: 0,
                errorCodes: ['ThrottledException'],
            },
            retryTargets: ['+222'],
            failure: {
                code: 'ThrottledException',
                isRetryable: true,
                retryAfterInMs: null,
                cause: new Error('private +222'),
            },
        });
        await expect(service.processSecurityAlert(job)).rejects.toMatchObject({
            isRetryable: true,
            messageProperties: { cause: 'ThrottledException' },
        });
        expect(job.updateData).toHaveBeenCalledWith({
            ...payload,
            phoneNumbers: ['+222'],
        });
    });

    it('does not hide a failed retry payload update', async () => {
        const job =
            mock<
                Job<
                    INotificationSendSmsPayload,
                    IQueueResponse,
                    EnumNotificationSmsProcess
                >
            >();
        job.opts = { attempts: 3 };
        job.attemptsMade = 0;
        job.data = payload;
        const error = new Error('redis unavailable');
        job.updateData.mockRejectedValue(error);
        notificationSmsSecurityDomain.process.mockResolvedValue({
            outcome: 'retry',
            summary: {
                acceptedCount: 0,
                failedCount: 1,
                invalidTargetCount: 0,
                errorCodes: ['ThrottledException'],
            },
            retryTargets: ['+222'],
            failure: {
                code: 'ThrottledException',
                isRetryable: true,
                retryAfterInMs: null,
                cause: null,
            },
        });
        await expect(service.processSecurityAlert(job)).rejects.toBe(error);
    });

    describe('processSecurityAlert', () => {
        it('processor routes the job to the sms security domain', async () => {
            notificationSmsSecurityDomain.process.mockResolvedValue(
                completedAttempt
            );
            const job = {
                attemptsMade: 0,
                opts: { attempts: 3 },
                data: payload,
            } as Job<
                INotificationSendSmsPayload,
                IQueueResponse,
                EnumNotificationSmsProcess
            >;

            const result = await service.processSecurityAlert(job);

            expect(notificationSmsSecurityDomain.process).toHaveBeenCalledWith(
                payload,
                false
            );
            expect(result).toEqual({
                message: 'SMS delivery attempt completed',
                result: completedAttempt.summary,
            });
        });

        it('passes isLastAttempt true on the final attempt', async () => {
            notificationSmsSecurityDomain.process.mockResolvedValue(
                completedAttempt
            );
            const job = {
                attemptsMade: 2,
                opts: { attempts: 3 },
                data: payload,
            } as Job<
                INotificationSendSmsPayload,
                IQueueResponse,
                EnumNotificationSmsProcess
            >;

            await service.processSecurityAlert(job);

            expect(notificationSmsSecurityDomain.process).toHaveBeenCalledWith(
                payload,
                true
            );
        });
    });

    describe('isLastAttempt', () => {
        it('is false while attempts remain', () => {
            const job = { attemptsMade: 1, opts: { attempts: 3 } } as Job;

            expect(service['isLastAttempt'](job)).toBe(false);
        });

        it('is true on the final configured attempt', () => {
            const job = { attemptsMade: 2, opts: { attempts: 3 } } as Job;

            expect(service['isLastAttempt'](job)).toBe(true);
        });

        it('treats a job without configured attempts as a single attempt', () => {
            const job = { attemptsMade: 0, opts: {} } as Job;

            expect(service['isLastAttempt'](job)).toBe(true);
        });
    });
});
