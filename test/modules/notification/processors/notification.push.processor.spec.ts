import { Test } from '@nestjs/testing';
import type { Scope } from '@sentry/nestjs';
import { Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationPushProcessor } from '@modules/notification/processors/notification.push.processor';
import { NotificationPushProcessorService } from '@modules/notification/services/notification.push.processor.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationPushProcess } from '@modules/notification/enums/notification.enum';

describe('NotificationPushProcessor delivery errors', () => {
    const service = mock<NotificationPushProcessorService>();
    const sentryService = mock<SentryService>();
    const job = mock<Job<unknown, null, EnumNotificationPushProcess>>();
    let processor: NotificationPushProcessor;
    beforeEach(async () => {
        vi.resetAllMocks();
        job.name = EnumNotificationPushProcess.resetPassword;
        job.opts = { attempts: 3 };
        job.attemptsMade = 1;
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushProcessor,
                {
                    provide: NotificationPushProcessorService,
                    useValue: service,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationPushProcessor);
    });
    it('rethrows a delivery failure as is so BullMQ retries it', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            cause: new Error('provider'),
        });
        service.processResetPassword.mockRejectedValue(failure);
        await expect(processor.process(job)).rejects.toBe(failure);
    });
    it('does not report to Sentry while attempts remain', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'Throttling',
            cause: null,
        });
        service.processResetPassword.mockRejectedValue(failure);
        const error: unknown = await processor
            .process(job)
            .catch((caught: unknown) => caught);
        if (!(error instanceof Error)) {
            throw error;
        }
        processor.onFailed(job, error);
        expect(sentryService.captureException).not.toHaveBeenCalled();
    });
    it('reports the final failure once and keeps provider details out of the job log', async () => {
        const scope = mock<Scope>();
        sentryService.withScope.mockImplementation(callback => callback(scope));
        const logs: string[] = [];
        job.log.mockImplementation(async message => {
            logs.push(message);
            return 1;
        });
        job.attemptsMade = 3;
        const failure = new NotificationDeliveryFailedException({
            code: 'messaging/invalid-argument',
            cause: new Error('private provider details'),
        });
        service.processResetPassword.mockRejectedValue(failure);
        const error: unknown = await processor
            .process(job)
            .catch((caught: unknown) => caught);
        if (!(error instanceof Error)) {
            throw error;
        }
        processor.onFailed(job, error);
        expect(sentryService.captureException).toHaveBeenCalledExactlyOnceWith(
            failure
        );
        expect(JSON.stringify(logs)).not.toContain('private provider details');
    });
});
