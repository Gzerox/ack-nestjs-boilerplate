import { Test } from '@nestjs/testing';
import type { Scope } from '@sentry/nestjs';
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationEmailProcessor } from '@modules/notification/processors/notification.email.processor';
import { NotificationEmailProcessorService } from '@modules/notification/services/notification.email.processor.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationEmailProcessor delivery errors', () => {
    const notificationEmailProcessorService =
        mock<NotificationEmailProcessorService>();
    const sentryService = mock<SentryService>();
    const job = mock<Job<unknown, IQueueResponse, EnumNotificationProcess>>();
    let processor: NotificationEmailProcessor;
    beforeEach(async () => {
        vi.resetAllMocks();
        job.name = EnumNotificationProcess.welcome;
        job.opts = { attempts: 3 };
        const module = await Test.createTestingModule({
            providers: [
                NotificationEmailProcessor,
                {
                    provide: NotificationEmailProcessorService,
                    useValue: notificationEmailProcessorService,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationEmailProcessor);
    });
    it('rethrows a delivery failure as is so BullMQ retries it', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            cause: new Error('provider'),
        });
        notificationEmailProcessorService.processWelcome.mockRejectedValue(
            failure
        );
        await expect(processor.process(job)).rejects.toBe(failure);
    });
    it('maps a decrypt failure to an UnrecoverableError', async () => {
        notificationEmailProcessorService.processWelcome.mockRejectedValue(
            new HelperDecryptFailedException()
        );
        await expect(processor.process(job)).rejects.toBeInstanceOf(
            UnrecoverableError
        );
    });
    it('reports a final bulk failure once through onFailed', async () => {
        const scope = mock<Scope>();
        sentryService.withScope.mockImplementation(callback => callback(scope));
        const bulkJob = mock<Job<unknown, null, EnumNotificationProcess>>();
        bulkJob.name = EnumNotificationProcess.publishTermPolicy;
        bulkJob.opts = { attempts: 3 };
        bulkJob.attemptsMade = 3;
        const failure = new NotificationDeliveryFailedException({
            code: 'bulkDeliveryFailed',
            cause: null,
        });
        notificationEmailProcessorService.processPublishTermPolicy.mockRejectedValue(
            failure
        );
        const error: unknown = await processor
            .process(bulkJob)
            .catch((caught: unknown) => caught);
        expect(error).toBe(failure);
        if (!(error instanceof Error)) {
            throw error;
        }
        processor.onFailed(bulkJob, error);
        expect(sentryService.captureException).toHaveBeenCalledExactlyOnceWith(
            error
        );
    });
});
