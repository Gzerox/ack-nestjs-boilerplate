import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EnumQueue, EnumQueuePriority } from '@queues/enums/queue.enum';

/**
 * Enqueues WhatsApp verification jobs, deduplicated per user and notification.
 */
@Injectable()
export class NotificationWhatsappQueue {
    private readonly dedupTtlInMs: number;

    constructor(
        @InjectQueue(EnumQueue.notificationWhatsapp)
        private readonly notificationWhatsappQueue: Queue,
        private readonly configService: ConfigService
    ) {
        this.dedupTtlInMs = this.configService.get<number>(
            'notification.dedupTtlInMs'
        )!;
    }

    async sendVerificationMobileNumber(
        payload: INotificationSendWhatsappVerificationPayload
    ): Promise<void> {
        const { userId, notificationId, phoneNumber } = payload;

        if (!phoneNumber) {
            return;
        }

        await this.notificationWhatsappQueue.add(
            EnumNotificationWhatsappProcess.verificationMobileNumber,
            payload,
            {
                priority: EnumQueuePriority.high,
                deduplication: {
                    id: `${EnumNotificationWhatsappProcess.verificationMobileNumber}-${userId}-${notificationId}`,
                    ttl: this.dedupTtlInMs,
                },
            }
        );
    }
}
