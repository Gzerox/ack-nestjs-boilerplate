import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationSmsProcessorService } from '@modules/notification/services/notification.sms.processor.service';
import { Job, UnrecoverableError } from 'bullmq';
import { QueueProcessorBase } from '@queues/bases/queue.processor.base';
import { SentryService } from '@common/sentry/services/sentry.service';
import { QueueProcessor } from '@queues/decorators/queue.decorator';
import { EnumQueue } from '@queues/enums/queue.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/**
 * Consumes the sms queue (SNS); every job is a security alert.
 */
@QueueProcessor(EnumQueue.notificationSms)
export class NotificationSmsProcessor extends QueueProcessorBase {
    constructor(
        private readonly notificationSmsProcessorService: NotificationSmsProcessorService,
        sentryService: SentryService
    ) {
        super(sentryService);
    }

    /** Dispatches each job to its handler by job name. */
    protected async handle(
        job: Job<unknown, IQueueResponse, EnumNotificationSmsProcess>
    ): Promise<IQueueResponse> {
        try {
            switch (job.name) {
                case EnumNotificationSmsProcess.temporaryPasswordByAdmin:
                case EnumNotificationSmsProcess.changePassword:
                case EnumNotificationSmsProcess.forgotPassword:
                case EnumNotificationSmsProcess.resetPassword:
                case EnumNotificationSmsProcess.resetTwoFactorByAdmin:
                case EnumNotificationSmsProcess.newDeviceLogin:
                    return await this.notificationSmsProcessorService.processSecurityAlert(
                        job as Job<
                            INotificationSendSmsPayload,
                            IQueueResponse,
                            EnumNotificationSmsProcess
                        >
                    );
                default:
                    return {
                        message: `No notification processor found for the given job name ${job.name}`,
                    };
            }
        } catch (error: unknown) {
            if (
                error instanceof NotificationDeliveryFailedException &&
                !error.isRetryable
            ) {
                const failure = new UnrecoverableError(error.message);
                failure.cause = error;
                throw failure;
            }

            throw error;
        }
    }
}
