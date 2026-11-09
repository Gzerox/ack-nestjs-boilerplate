import { Injectable } from '@nestjs/common';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import type {
    INotificationContent,
    INotificationDeliveryContext,
    INotificationDeliveryFailure,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationDeliveryDomain {
    constructor(
        private readonly notificationRepository: NotificationRepository
    ) {}

    async begin({
        userId,
        notificationId,
        channel,
    }: INotificationDeliveryContext): Promise<INotificationContent | null> {
        const content = await this.notificationRepository.findForDelivery(
            userId,
            notificationId,
            channel
        );
        return content;
    }

    async completeEmail(
        userId: string,
        notificationId: string,
        messageId: string | null
    ): Promise<boolean> {
        if (!messageId) {
            return false;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return true;
    }

    async fail(
        { userId, notificationId, channel }: INotificationDeliveryContext,
        failure: INotificationDeliveryFailure,
        failureTokens: string[]
    ): Promise<never> {
        await this.notificationRepository.markFailed(
            userId,
            notificationId,
            channel,
            failureTokens
        );
        throw new NotificationDeliveryFailedException(failure);
    }
}
