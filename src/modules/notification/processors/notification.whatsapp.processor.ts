import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationWhatsappProcessorService } from '@modules/notification/services/notification.whatsapp.processor.service';
import { Job, UnrecoverableError } from 'bullmq';
import { QueueProcessorBase } from '@queues/bases/queue.processor.base';
import { SentryService } from '@common/sentry/services/sentry.service';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { QueueProcessor } from '@queues/decorators/queue.decorator';
import { EnumQueue } from '@queues/enums/queue.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/**
 * Consumes the whatsapp queue; account verification codes.
 */
@QueueProcessor(EnumQueue.notificationWhatsapp)
export class NotificationWhatsappProcessor extends QueueProcessorBase {
    constructor(
        private readonly notificationWhatsappProcessorService: NotificationWhatsappProcessorService,
        sentryService: SentryService
    ) {
        super(sentryService);
    }

    /** Dispatches each job to its handler by job name. */
    protected async handle(
        job: Job<unknown, IQueueResponse, EnumNotificationWhatsappProcess>
    ): Promise<IQueueResponse> {
        switch (job.name) {
            case EnumNotificationWhatsappProcess.verificationMobileNumber:
                try {
                    return await this.notificationWhatsappProcessorService.processVerificationMobileNumber(
                        job as Job<
                            INotificationSendWhatsappVerificationPayload,
                            IQueueResponse,
                            EnumNotificationWhatsappProcess
                        >
                    );
                } catch (error: unknown) {
                    if (error instanceof HelperDecryptFailedException) {
                        throw new UnrecoverableError(error.message);
                    }

                    throw error;
                }
            default:
                return {
                    message: `No notification processor found for the given job name ${job.name}`,
                };
        }
    }
}
