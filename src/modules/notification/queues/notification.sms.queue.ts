import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EnumQueue, EnumQueuePriority } from '@queues/enums/queue.enum';

/**
 * Enqueues security alert SMS jobs (SNS) onto the sms queue, deduplicated per user and kind.
 */
@Injectable()
export class NotificationSmsQueue {
    private readonly dedupTtlInMs: number;

    constructor(
        @InjectQueue(EnumQueue.notificationSms)
        private readonly notificationSmsQueue: Queue,
        private readonly configService: ConfigService
    ) {
        this.dedupTtlInMs = this.configService.get<number>(
            'notification.dedupTtlInMs'
        )!;
    }

    async sendSecurityAlert({
        userId,
        notificationId,
        kind,
        phoneNumbers,
    }: INotificationSendSmsPayload): Promise<void> {
        if (phoneNumbers.length === 0) {
            return;
        }

        const payload: INotificationSendSmsPayload = {
            userId,
            notificationId,
            kind,
            phoneNumbers,
        };

        await this.notificationSmsQueue.add(kind, payload, {
            priority: EnumQueuePriority.high,
            deduplication: {
                id: `${kind}-${userId}`,
                ttl: this.dedupTtlInMs,
            },
        });
    }
}
