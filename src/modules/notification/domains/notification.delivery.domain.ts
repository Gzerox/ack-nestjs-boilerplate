import { Injectable } from '@nestjs/common';
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

    async fail(
        { userId, notificationId, channel }: INotificationDeliveryContext,
        failure: INotificationDeliveryFailure,
        isLastAttempt: boolean,
        failureTokens: string[]
    ): Promise<never> {
        if (failure.isRetryable && !isLastAttempt) {
            await this.notificationRepository.markRetry(
                userId,
                notificationId,
                channel,
                failure.code,
                failureTokens
            );
        } else {
            await this.notificationRepository.markFailed(
                userId,
                notificationId,
                channel,
                failure.code,
                failureTokens
            );
        }
        throw new NotificationDeliveryFailedException(failure);
    }
}
