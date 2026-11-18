import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationWhatsappAccountDomain } from '@modules/notification/domains/notification.whatsapp.account.domain';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

@Injectable()
export class NotificationWhatsappProcessorService {
    constructor(
        private readonly notificationWhatsappAccountDomain: NotificationWhatsappAccountDomain
    ) {}

    async processVerificationMobileNumber(
        job: Job<
            INotificationSendWhatsappVerificationPayload,
            IQueueResponse,
            EnumNotificationWhatsappProcess
        >
    ): Promise<IQueueResponse> {
        const result =
            await this.notificationWhatsappAccountDomain.processVerificationMobileNumber(
                job.data
            );

        return result;
    }
}
