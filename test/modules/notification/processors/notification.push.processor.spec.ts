import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationPushProcessor } from '@modules/notification/processors/notification.push.processor';
import { NotificationPushProcessorService } from '@modules/notification/services/notification.push.processor.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationPushProcess } from '@modules/notification/enums/notification.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationPushProcessor delivery errors', () => {
    const notificationPushProcessorService =
        mock<NotificationPushProcessorService>();
    const sentryService = mock<SentryService>();
    const job =
        mock<Job<unknown, IQueueResponse, EnumNotificationPushProcess>>();
    let processor: NotificationPushProcessor;
    beforeEach(async () => {
        vi.resetAllMocks();
        job.name = EnumNotificationPushProcess.resetPassword;
        job.opts = { attempts: 3 };
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushProcessor,
                {
                    provide: NotificationPushProcessorService,
                    useValue: notificationPushProcessorService,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationPushProcessor);
    });
    it('allows a typed transient error to use the remaining queue budget', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            isRetryable: true,
            retryAfterInMs: null,
            cause: new Error('provider'),
        });
        notificationPushProcessorService.processResetPassword.mockRejectedValue(
            failure
        );
        await expect(processor.process(job)).rejects.toBe(failure);
    });
    it('preserves the original typed error as the cause of an unrecoverable failure', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'MessageRejected',
            isRetryable: false,
            retryAfterInMs: null,
            cause: new Error('provider'),
        });
        notificationPushProcessorService.processResetPassword.mockRejectedValue(
            failure
        );
        const attempt = processor.process(job);
        await expect(attempt).rejects.toBeInstanceOf(UnrecoverableError);
        await expect(attempt).rejects.toMatchObject({ cause: failure });
    });
});
