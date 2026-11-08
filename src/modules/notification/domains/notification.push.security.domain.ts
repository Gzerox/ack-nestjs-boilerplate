import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { MessageService } from '@common/message/services/message.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import type {
    INotificationNewDeviceLoginPayload,
    INotificationSendPushPayload,
    INotificationTemporaryPasswordPushPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { Injectable } from '@nestjs/common';
import { QueueException } from '@queues/exceptions/queue.exception';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and delivers the password, two-factor and new-device login push messages. */
@Injectable()
export class NotificationPushSecurityDomain {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly notificationRepository: NotificationRepository,
        private readonly messageService: MessageService,
        private readonly helperDateService: HelperDateService,
        private readonly requestContextService: RequestContextService,
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

    async processNewDeviceLogin(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationNewDeviceLoginPayload,
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
                    'Delivery already sent or missing, skipping new login notification',
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
                    'Firebase not initialized, skipping new login notification',
            };
        }

        const device = this.requestContextService.resolveDevice(
            data.requestLog.userAgent
        );
        const city = this.requestContextService.resolveCity(
            data.requestLog.geoLocation
        );
        const loginAtDate = this.helperDateService.createFromIso(data.loginAt);
        const loginAt = this.helperDateService.formatToRFC2822(loginAtDate);
        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: { device, city, username, loginAt },
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
            message: 'New login notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processResetTwoFactorByAdmin(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
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
                    'Delivery already sent or missing, skipping reset two-factor notification',
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
                    'Firebase not initialized, skipping reset two-factor notification',
            };
        }

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: { username },
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
            message: 'Reset two-factor notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processTemporaryPasswordByAdmin(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
        data: INotificationTemporaryPasswordPushPayload,
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
                    'Delivery already sent or missing, skipping temporary password notification',
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
                    'Firebase not initialized, skipping temporary password notification',
            };
        }

        const passwordExpiredAtDate = this.helperDateService.createFromIso(
            data.passwordExpiredAt
        );
        const passwordExpiredAt = this.helperDateService.formatToRFC2822(
            passwordExpiredAtDate
        );

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: { username, passwordExpiredAt },
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
            message: 'Temporary password notification processed',
            result: {
                successCount: result.successCount,
                failureCount: result.failureCount,
                errorCodes: [
                    ...new Set(result.failures.map(({ error }) => error.code)),
                ],
            },
        };
    }

    async processResetPassword(
        {
            notificationTokens,
            username,
            notificationId,
            userId,
        }: INotificationSendPushPayload,
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
                    'Delivery already sent or missing, skipping reset password notification',
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
                    'Firebase not initialized, skipping reset password notification',
            };
        }

        const title = this.messageService.setMessage(notification.title);
        const body = this.messageService.setMessage(notification.body, {
            properties: { username },
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
            message: 'Reset password notification processed',
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
