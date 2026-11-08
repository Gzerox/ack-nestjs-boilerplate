import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationSmsProcessor } from '@modules/notification/processors/notification.sms.processor';
import { NotificationSmsProcessorService } from '@modules/notification/services/notification.sms.processor.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationSmsProcessor delivery errors', () => {
    const notificationSmsProcessorService =
        mock<NotificationSmsProcessorService>();
    const sentryService = mock<SentryService>();
    const job =
        mock<Job<unknown, IQueueResponse, EnumNotificationSmsProcess>>();
    let processor: NotificationSmsProcessor;
    beforeEach(async () => {
        vi.resetAllMocks();
        job.name = EnumNotificationSmsProcess.resetPassword;
        job.opts = { attempts: 3 };
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsProcessor,
                {
                    provide: NotificationSmsProcessorService,
                    useValue: notificationSmsProcessorService,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationSmsProcessor);
    });
    it('allows a typed transient error to use the remaining queue budget', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            isRetryable: true,
            retryAfterInMs: null,
            cause: new Error('provider'),
        });
        notificationSmsProcessorService.processSecurityAlert.mockRejectedValue(
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
        notificationSmsProcessorService.processSecurityAlert.mockRejectedValue(
            failure
        );
        const attempt = processor.process(job);
        await expect(attempt).rejects.toBeInstanceOf(UnrecoverableError);
        await expect(attempt).rejects.toMatchObject({ cause: failure });
    });
});
