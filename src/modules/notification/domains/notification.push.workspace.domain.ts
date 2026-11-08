import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import type {
    INotificationSendPushPayload,
    INotificationWorkspaceInvitePushPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestPushPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { Injectable } from '@nestjs/common';
import { QueueException } from '@queues/exceptions/queue.exception';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and delivers the workspace invite and join-request push messages. */
@Injectable()
export class NotificationPushWorkspaceDomain {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly notificationRepository: NotificationRepository,
        private readonly messageService: MessageService,
        private readonly notificationPushQueue: NotificationPushQueue
    ) {}

    private async handleSendFailure(
        userId: string,
        notificationId: string,
        result: IFirebasePushResult,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const failure =
            result.failures.find(({ error }) => error.isRetryable)?.error ??
            result.failures.find(({ error }) => !error.isInvalidToken)?.error;
        if (!failure) {
            // Sequential by design: token cleanup follows the delivery mark, an order the contract fixes.
            await this.notificationRepository.markFailed(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                'allTokensInvalid',
                result.failureTokens
            );
            const cleanupPromise = this.notificationPushQueue.sendCleanupTokens(
                userId,
                result.failureTokens
            );
            await Promise.allSettled([cleanupPromise]);

            return {
                message: 'Push delivery failed, every token is invalid',
                result: {
                    successCount: result.successCount,
                    failureCount: result.failureCount,
                    errorCodes: [
                        ...new Set(
                            result.failures.map(({ error }) => error.code)
                        ),
                    ],
                },
            };
        }

        if (!failure.isRetryable) {
            await this.notificationRepository.markFailed(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                failure.code,
                result.failureTokens
            );

            throw new NotificationDeliveryFailedException({
                code: failure.code,
                isRetryable: false,
                retryAfterInMs: failure.retryAfterInMs,
                cause: failure.cause,
            });
        }

        if (!isLastAttempt) {
            await this.notificationRepository.markRetry(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                failure.code,
                result.failureTokens
            );

            throw new QueueException(failure.code, true);
        }

        await this.notificationRepository.markFailed(
            userId,
            notificationId,
            EnumNotificationChannel.push,
            failure.code,
            result.failureTokens
        );

        throw new QueueException(failure.code, true);
    }

    async processWorkspaceInvite(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationWorkspaceInvitePushPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const notification = await this.notificationRepository.markProcessing(
            userId,
            notificationId,
            EnumNotificationChannel.push
        );
        if (!notification) {
            return {
                message:
                    'Delivery already sent or missing, skipping workspace invite notification',
            };
        }

        const isInitialized = this.firebaseService.isInitialized();
        if (!isInitialized) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                notification.failureTokens
            );

            return {
                message:
                    'Firebase not initialized, skipping workspace invite notification',
            };
        }

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: {
                username,
                workspaceName: data.workspaceName,
                inviterName: data.inviterName,
            },
        });

        const providerResult = await this.firebaseService.sendMulticast(
            notificationTokens,
            {
                title,
                body,
            }
        );
        const result = {
            ...providerResult,
            failureTokens: [
                ...new Set([
                    ...notification.failureTokens,
                    ...providerResult.failureTokens,
                ]),
            ],
        };

        if (result.successCount === 0) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                result,
                isLastAttempt
            );

            return failure;
        }

        // Sequential by design: token cleanup follows the delivery mark, an order the contract fixes.
        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.push,
            result.failureTokens
        );
        const cleanupPromise = this.notificationPushQueue.sendCleanupTokens(
            userId,
            result.failureTokens
        );
        await Promise.allSettled([cleanupPromise]);

        return {
            message: 'Workspace invite notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processWorkspaceJoinRequest(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRequestPushPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const notification = await this.notificationRepository.markProcessing(
            userId,
            notificationId,
            EnumNotificationChannel.push
        );
        if (!notification) {
            return {
                message:
                    'Delivery already sent or missing, skipping workspace join request notification',
            };
        }

        const isInitialized = this.firebaseService.isInitialized();
        if (!isInitialized) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                notification.failureTokens
            );

            return {
                message:
                    'Firebase not initialized, skipping workspace join request notification',
            };
        }

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: {
                username,
                workspaceName: data.workspaceName,
                requesterName: data.requesterName,
            },
        });

        const providerResult = await this.firebaseService.sendMulticast(
            notificationTokens,
            {
                title,
                body,
            }
        );
        const result = {
            ...providerResult,
            failureTokens: [
                ...new Set([
                    ...notification.failureTokens,
                    ...providerResult.failureTokens,
                ]),
            ],
        };

        if (result.successCount === 0) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                result,
                isLastAttempt
            );

            return failure;
        }

        // Sequential by design: token cleanup follows the delivery mark, an order the contract fixes.
        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.push,
            result.failureTokens
        );
        const cleanupPromise = this.notificationPushQueue.sendCleanupTokens(
            userId,
            result.failureTokens
        );
        await Promise.allSettled([cleanupPromise]);

        return {
            message: 'Workspace join request notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processWorkspaceJoinAccepted(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinAcceptedPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const notification = await this.notificationRepository.markProcessing(
            userId,
            notificationId,
            EnumNotificationChannel.push
        );
        if (!notification) {
            return {
                message:
                    'Delivery already sent or missing, skipping workspace join accepted notification',
            };
        }

        const isInitialized = this.firebaseService.isInitialized();
        if (!isInitialized) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                notification.failureTokens
            );

            return {
                message:
                    'Firebase not initialized, skipping workspace join accepted notification',
            };
        }

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: {
                username,
                workspaceName: data.workspaceName,
            },
        });

        const providerResult = await this.firebaseService.sendMulticast(
            notificationTokens,
            {
                title,
                body,
            }
        );
        const result = {
            ...providerResult,
            failureTokens: [
                ...new Set([
                    ...notification.failureTokens,
                    ...providerResult.failureTokens,
                ]),
            ],
        };

        if (result.successCount === 0) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                result,
                isLastAttempt
            );

            return failure;
        }

        // Sequential by design: token cleanup follows the delivery mark, an order the contract fixes.
        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.push,
            result.failureTokens
        );
        const cleanupPromise = this.notificationPushQueue.sendCleanupTokens(
            userId,
            result.failureTokens
        );
        await Promise.allSettled([cleanupPromise]);

        return {
            message: 'Workspace join accepted notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processWorkspaceJoinRejected(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRejectedPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const notification = await this.notificationRepository.markProcessing(
            userId,
            notificationId,
            EnumNotificationChannel.push
        );
        if (!notification) {
            return {
                message:
                    'Delivery already sent or missing, skipping workspace join rejected notification',
            };
        }

        const isInitialized = this.firebaseService.isInitialized();
        if (!isInitialized) {
            await this.notificationRepository.markSkipped(
                userId,
                notificationId,
                EnumNotificationChannel.push,
                notification.failureTokens
            );

            return {
                message:
                    'Firebase not initialized, skipping workspace join rejected notification',
            };
        }

        const rejectReasonLabel = this.messageService.setMessage(
            `notification.rejectReason.${data.rejectReasonCode}`
        );

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: {
                username,
                workspaceName: data.workspaceName,
                rejectReasonLabel,
            },
        });

        const providerResult = await this.firebaseService.sendMulticast(
            notificationTokens,
            {
                title,
                body,
            }
        );
        const result = {
            ...providerResult,
            failureTokens: [
                ...new Set([
                    ...notification.failureTokens,
                    ...providerResult.failureTokens,
                ]),
            ],
        };

        if (result.successCount === 0) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                result,
                isLastAttempt
            );

            return failure;
        }

        // Sequential by design: token cleanup follows the delivery mark, an order the contract fixes.
        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.push,
            result.failureTokens
        );
        const cleanupPromise = this.notificationPushQueue.sendCleanupTokens(
            userId,
            result.failureTokens
        );
        await Promise.allSettled([cleanupPromise]);

        return {
            message: 'Workspace join rejected notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }
}
