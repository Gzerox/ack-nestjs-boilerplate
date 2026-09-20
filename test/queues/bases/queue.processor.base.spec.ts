import { createMock } from '@golevelup/ts-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationProcessor } from '@modules/notification/processors/notification.processor';
import { NotificationProcessorService } from '@modules/notification/services/notification.processor.service';
import { QueueException } from '@queues/exceptions/queue.exception';
import { createQueueJob } from '@test/support/queue-job.mock';

describe('QueueProcessorBase', () => {
    const sentryService = createMock<SentryService>();
    const processor = new NotificationProcessor(
        createMock<NotificationProcessorService>(),
        sentryService
    );

    beforeEach(() => vi.resetAllMocks());

    it('reports a fatal error on the final attempt', () => {
        const error = new Error('fatal');
        const job = createQueueJob<unknown, null, string>('job', {});
        job.opts.attempts = 3;
        Object.defineProperty(job, 'attemptsMade', { value: 3 });

        processor.onFailed(job, error);

        expect(sentryService.captureException).toHaveBeenCalledWith(error);
    });

    it('does not report before the final attempt', () => {
        const job = createQueueJob<unknown, null, string>('job', {});
        job.opts.attempts = 3;
        Object.defineProperty(job, 'attemptsMade', { value: 2 });

        processor.onFailed(job, new Error('retry'));

        expect(sentryService.captureException).not.toHaveBeenCalled();
    });

    it('does not report a nonfatal queue exception', () => {
        const job = createQueueJob<unknown, null, string>('job', {});

        processor.onFailed(job, new QueueException('expected', false));

        expect(sentryService.captureException).not.toHaveBeenCalled();
    });

    it('propagates a Sentry reporting failure', () => {
        sentryService.captureException.mockImplementation(() => {
            throw new Error('sentry unavailable');
        });
        const job = createQueueJob<unknown, null, string>('job', {});
        job.opts.attempts = 1;
        Object.defineProperty(job, 'attemptsMade', { value: 1 });

        expect(() => processor.onFailed(job, new Error('fatal'))).toThrow(
            'sentry unavailable'
        );
    });
});
