import { Injectable } from '@nestjs/common';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { MessageService } from '@common/message/services/message.service';
import type { IMessageProperties } from '@common/message/interfaces/message.interface';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import type {
    INotificationDeliveryAttempt,
    INotificationDeliveryFailure,
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
        properties: IMessageProperties,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const { userId, notificationId } = send;
        const context = {
            userId,
            notificationId,
            channel: EnumNotificationChannel.push,
        };
        const providerReady = this.firebaseService.isInitialized();
        const content = await this.notificationDeliveryDomain.begin(
            context,
            providerReady
        );
        const emptySummary: INotificationDeliverySummary = {
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        };
        if (!content) {
            return { outcome: 'completed', summary: emptySummary };
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
            return { outcome: 'completed', summary: emptySummary };
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
                    isRetryable: false,
                    retryAfterInMs: null,
                    cause: error instanceof Error ? error : null,
                },
                isLastAttempt,
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
            const classified = this.firebaseService.classifyError(error);
            result = {
                successCount: 0,
                failureCount: tokens.length,
                failureTokens: classified.isInvalidToken ? tokens : [],
                failures: tokens.map(token => ({ token, error: classified })),
            };
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
            return { outcome: 'completed', summary };
        }
        if (
            result.failures.length > 0 &&
            result.failures.every(({ error }) => error.isInvalidToken)
        ) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                context.channel,
                failureTokens
            );
            await this.cleanup(userId, failureTokens);
            return { outcome: 'completed', summary };
        }
        const transient = result.failures.filter(
            ({ error }) => error.isRetryable && !error.isInvalidToken
        );
        let selected: INotificationDeliveryFailure = transient[0]?.error ??
            result.failures.find(({ error }) => !error.isInvalidToken)
                ?.error ?? {
                code: 'unknownError',
                isRetryable: false,
                retryAfterInMs: null,
                cause: null,
            };
        for (const { error } of transient) {
            if ((error.retryAfterInMs ?? 0) > (selected.retryAfterInMs ?? 0)) {
                selected = error;
            }
        }
        const failure: INotificationDeliveryFailure = {
            code: selected.code,
            isRetryable: selected.isRetryable,
            retryAfterInMs: selected.retryAfterInMs,
            cause: selected.cause,
        };
        try {
            const failed = await this.notificationDeliveryDomain.fail(
                context,
                failure,
                isLastAttempt,
                failureTokens
            );
            return failed;
        } catch (error: unknown) {
            if (!(error instanceof NotificationDeliveryFailedException)) {
                throw error;
            }
            await this.cleanup(userId, failureTokens);
            if (error.isRetryable && !isLastAttempt) {
                return {
                    outcome: 'retry',
                    summary,
                    retryTargets: transient.map(({ token }) => token),
                    failure,
                };
            }
            throw error;
        }
    }
}
