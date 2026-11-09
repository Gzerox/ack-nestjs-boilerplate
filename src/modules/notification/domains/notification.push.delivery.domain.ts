import { Injectable } from '@nestjs/common';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { MessageService } from '@common/message/services/message.service';
import type { IMessageProperties } from '@common/message/interfaces/message.interface';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import type {
    INotificationDeliverySummary,
    INotificationSendPushPayload,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationPushDeliveryDomain {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly notificationDeliveryDomain: NotificationDeliveryDomain,
        private readonly notificationRepository: NotificationRepository,
        private readonly messageService: MessageService,
        private readonly notificationPushQueue: NotificationPushQueue
    ) {}

    private async cleanup(
        userId: string,
        failureTokens: string[]
    ): Promise<void> {
        if (failureTokens.length === 0) {
            return;
        }
        const cleanup = this.notificationPushQueue.sendCleanupTokens(
            userId,
            failureTokens
        );
        await Promise.allSettled([cleanup]);
    }

    async send(
        send: INotificationSendPushPayload,
        properties: IMessageProperties
    ): Promise<INotificationDeliverySummary> {
        const { userId, notificationId } = send;
        const context = {
            userId,
            notificationId,
            channel: EnumNotificationChannel.push,
        };
        const emptySummary: INotificationDeliverySummary = {
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        };
        const providerReady = this.firebaseService.isInitialized();
        if (!providerReady) {
            return emptySummary;
        }
        const content = await this.notificationDeliveryDomain.begin(context);
        if (!content) {
            return emptySummary;
        }
        const knownInvalid = new Set(content.failureTokens);
        const tokens = [...new Set(send.notificationTokens)].filter(
            token => !knownInvalid.has(token)
        );
        if (tokens.length === 0) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                context.channel,
                content.failureTokens
            );
            await this.cleanup(userId, content.failureTokens);
            return emptySummary;
        }
        let title: string;
        let body: string;
        try {
            const renderedTitle = this.messageService.setMessage(content.title);
            title = renderedTitle;
            const renderedBody = this.messageService.setMessage(content.body, {
                properties,
            });
            body = renderedBody;
        } catch (error: unknown) {
            const failed = await this.notificationDeliveryDomain.fail(
                context,
                {
                    code: 'renderFailed',
                    cause: error instanceof Error ? error : null,
                },
                content.failureTokens
            );
            return failed;
        }
        let result: IFirebasePushResult;
        try {
            const sent = await this.firebaseService.sendMulticast(tokens, {
                title,
                body,
            });
            result = sent;
        } catch (error: unknown) {
            const failure = this.firebaseService.classifyError(error);
            const failed = await this.notificationDeliveryDomain.fail(
                context,
                failure,
                content.failureTokens
            );
            return failed;
        }
        const failureTokens = [
            ...new Set([...content.failureTokens, ...result.failureTokens]),
        ];
        const summary: INotificationDeliverySummary = {
            acceptedCount: result.successCount,
            failedCount: result.failureCount,
            invalidTargetCount: result.failureTokens.length,
            errorCodes: [
                ...new Set(result.failures.map(({ error }) => error.code)),
            ],
        };
        if (result.successCount > 0) {
            await this.notificationRepository.markSent(
                userId,
                notificationId,
                context.channel,
                failureTokens
            );
            await this.cleanup(userId, failureTokens);
            return summary;
        }
        const failing = result.failures.find(
            ({ error }) => !error.isInvalidToken
        );
        if (!failing) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                context.channel,
                failureTokens
            );
            await this.cleanup(userId, failureTokens);
            return summary;
        }
        await this.cleanup(userId, failureTokens);
        const failed = await this.notificationDeliveryDomain.fail(
            context,
            { code: failing.error.code, cause: failing.error.cause },
            failureTokens
        );
        return failed;
    }
}
