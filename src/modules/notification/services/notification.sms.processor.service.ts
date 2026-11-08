import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationSmsSecurityDomain } from '@modules/notification/domains/notification.sms.security.domain';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

@Injectable()
export class NotificationSmsProcessorService {
    constructor(
        private readonly notificationSmsSecurityDomain: NotificationSmsSecurityDomain
    ) {}

    private isLastAttempt(job: Job): boolean {
        const maxAttempts = job.opts.attempts ?? 1;

        return job.attemptsMade + 1 >= maxAttempts;
    }

    async processSecurityAlert(
        job: Job<
            INotificationSendSmsPayload,
            IQueueResponse,
            EnumNotificationSmsProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        const attempt = await this.notificationSmsSecurityDomain.process(
            job.data,
            isLastAttempt
        );
        if (attempt.outcome === 'retry') {
            await job.updateData({
                ...job.data,
                phoneNumbers: attempt.retryTargets,
            });
            throw new NotificationDeliveryFailedException(attempt.failure);
        }
        return {
            message: 'SMS delivery attempt completed',
            result: attempt.summary,
        };
    }
}
