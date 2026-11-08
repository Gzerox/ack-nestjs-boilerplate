import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationEmailProcessor } from '@modules/notification/processors/notification.email.processor';
import { NotificationEmailProcessorService } from '@modules/notification/services/notification.email.processor.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
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
    it('allows a typed transient error to use the remaining queue budget', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            isRetryable: true,
            retryAfterInMs: null,
            cause: new Error('provider'),
        });
        notificationEmailProcessorService.processWelcome.mockRejectedValue(
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
        notificationEmailProcessorService.processWelcome.mockRejectedValue(
            failure
        );
        const attempt = processor.process(job);
        await expect(attempt).rejects.toBeInstanceOf(UnrecoverableError);
        await expect(attempt).rejects.toMatchObject({ cause: failure });
    });
    it.each([false, true])(
        'routes an unregistered invitation failure according to retry policy (%s)',
        async isRetryable => {
            job.name = EnumNotificationProcess.workspaceInviteUnregistered;
            const failure = new NotificationDeliveryFailedException({
                code: 'providerFailure',
                isRetryable,
                retryAfterInMs: null,
                cause: null,
            });
            notificationEmailProcessorService.processWorkspaceInviteUnregistered.mockRejectedValue(
                failure
            );
            if (isRetryable)
                await expect(processor.process(job)).rejects.toBe(failure);
            else
                await expect(processor.process(job)).rejects.toMatchObject({
                    name: 'UnrecoverableError',
                    cause: failure,
                });
        }
    );
});
