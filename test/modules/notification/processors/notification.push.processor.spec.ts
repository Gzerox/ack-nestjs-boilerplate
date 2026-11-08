import { Worker } from 'bullmq';
import { NotificationRetryUtil } from '@modules/notification/utils/notification.retry.util';
import type { Scope } from '@sentry/nestjs';
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
    const retryUtil = mock<NotificationRetryUtil>();
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
                { provide: NotificationRetryUtil, useValue: retryUtil },
                {
                    provide: NotificationPushProcessorService,
                    useValue: notificationPushProcessorService,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationPushProcessor);
    });
    it('installs the backoff strategy before starting the worker', () => {
        const worker = mock<Worker>();
        Object.defineProperty(worker, 'opts', {
            value: {
                connection: { host: 'localhost', port: 6379 },
                settings: {},
            },
            configurable: true,
        });
        worker.run.mockResolvedValue(undefined);
        retryUtil.delay.mockReturnValue(12345);
        Object.defineProperty(processor, '_worker', {
            value: worker,
            configurable: true,
        });
        worker.run.mockImplementation(async () => {
            expect(worker.opts.settings?.backoffStrategy).toBeTypeOf(
                'function'
            );
        });
        processor.onApplicationBootstrap();
        expect(worker.run).toHaveBeenCalledOnce();
        expect(
            worker.opts.settings?.backoffStrategy?.(
                1,
                'notificationPush',
                new Error('local')
            )
        ).toBe(12345);
        expect(retryUtil.delay).toHaveBeenCalledWith(1, null);
        expect(
            Reflect.getMetadata(
                'bullmq:worker_metadata',
                NotificationPushProcessor
            )
        ).toMatchObject({
            autorun: false,
            limiter: { max: 500000, duration: 60000 },
        });
    });
    it('forwards a rejected worker run to the worker error event', async () => {
        const worker = mock<Worker>();
        Object.defineProperty(worker, 'opts', {
            value: {
                connection: { host: 'localhost', port: 6379 },
                settings: {},
            },
            configurable: true,
        });
        const error = new Error('worker failed');
        worker.run.mockRejectedValue(error);
        Object.defineProperty(processor, '_worker', {
            value: worker,
            configurable: true,
        });
        processor.onApplicationBootstrap();
        await Promise.resolve();
        await Promise.resolve();
        expect(worker.emit).toHaveBeenCalledWith('error', error);
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
    it('reports a final permanent failure once and keeps provider details out of the job log', async () => {
        expect.assertions(4);
        const scope = mock<Scope>();
        sentryService.withScope.mockImplementation(callback => callback(scope));
        const failedJob =
            mock<Job<unknown, null, EnumNotificationPushProcess>>();
        const logs: string[] = [];
        failedJob.log.mockImplementation(async message => {
            logs.push(message);
            return 1;
        });
        failedJob.name = EnumNotificationPushProcess.resetPassword;
        failedJob.opts = { attempts: 3 };
        failedJob.attemptsMade = 1;
        const failure = new NotificationDeliveryFailedException({
            code: 'messaging/invalid-argument',
            isRetryable: false,
            retryAfterInMs: null,
            cause: new Error('private provider details'),
        });
        notificationPushProcessorService.processResetPassword.mockRejectedValue(
            failure
        );
        try {
            await processor.process(failedJob);
        } catch (error: unknown) {
            expect(error).toBeInstanceOf(UnrecoverableError);
            if (!(error instanceof Error)) {
                throw error;
            }
            expect(sentryService.captureException).not.toHaveBeenCalled();
            processor.onFailed(failedJob, error);
            expect(sentryService.captureException).toHaveBeenCalledTimes(1);
            expect(JSON.stringify(logs)).not.toContain(
                'private provider details'
            );
        }
    });
});
