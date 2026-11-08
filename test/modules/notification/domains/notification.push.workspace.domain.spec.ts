import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { MessageService } from '@common/message/services/message.service';
import {
    EnumNotificationChannel,
    EnumWorkspaceJoinRejectReason,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import { NotificationPushWorkspaceDomain } from '@modules/notification/domains/notification.push.workspace.domain';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type {
    INotificationContent,
    INotificationSendPushPayload,
    INotificationWorkspaceInvitePushPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestPushPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { QueueException } from '@queues/exceptions/queue.exception';

describe('NotificationPushWorkspaceDomain', () => {
    const firebaseService = mock<FirebaseService>();
    const notificationRepository = mock<NotificationRepository>();
    const messageService = mock<MessageService>();
    const notificationPushQueue = mock<NotificationPushQueue>();
    let domain: NotificationPushWorkspaceDomain;

    const send: INotificationSendPushPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        notificationTokens: ['token-1', 'token-2'],
        username: 'nadia',
    };
    const content: INotificationContent = {
        title: 'title',
        body: 'body',
        failureTokens: [],
    };
    const pushResult: IFirebasePushResult = {
        failureTokens: ['token-2'],
        successCount: 1,
        failureCount: 1,
        failures: [
            {
                token: 'token-2',
                error: {
                    code: 'messaging/registration-token-not-registered',
                    isInvalidToken: true,
                    isRetryable: false,
                    retryAfterInMs: null,
                    cause: null,
                },
            },
        ],
    };
    const invalidResult: IFirebasePushResult = {
        failureTokens: ['token-1', 'token-2'],
        successCount: 0,
        failureCount: 2,
        failures: ['token-1', 'token-2'].map(token => ({
            token,
            error: {
                code: 'messaging/registration-token-not-registered',
                isInvalidToken: true,
                isRetryable: false,
                retryAfterInMs: null,
                cause: null,
            },
        })),
    };
    const retryableResult: IFirebasePushResult = {
        failureTokens: [],
        successCount: 0,
        failureCount: 2,
        failures: ['token-1', 'token-2'].map(token => ({
            token,
            error: {
                code: 'messaging/internal-error',
                isInvalidToken: false,
                isRetryable: true,
                retryAfterInMs: null,
                cause: null,
            },
        })),
    };
    const permanentResult: IFirebasePushResult = {
        failureTokens: [],
        successCount: 0,
        failureCount: 2,
        failures: ['token-1', 'token-2'].map(token => ({
            token,
            error: {
                code: 'messaging/invalid-argument',
                isInvalidToken: false,
                isRetryable: false,
                retryAfterInMs: null,
                cause: null,
            },
        })),
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushWorkspaceDomain,
                { provide: FirebaseService, useValue: firebaseService },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                { provide: MessageService, useValue: messageService },
                {
                    provide: NotificationPushQueue,
                    useValue: notificationPushQueue,
                },
            ],
        }).compile();
        domain = module.get(NotificationPushWorkspaceDomain);
    });

    describe('processWorkspaceInvite', () => {
        const data: INotificationWorkspaceInvitePushPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            inviterName: 'Omar',
            workspaceMemberRole: EnumWorkspaceMemberRole.member,
            reference: 'ref-1',
            expiredAt: '2024-02-01T00:00:00.000Z',
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceInvite(
                send,
                data,
                false
            );

            expect(notificationRepository.markProcessing).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push
            );
            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace invite notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceInvite(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                []
            );
            expect(result).toEqual({
                message:
                    'Firebase not initialized, skipping workspace invite notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Workspace invite')
                .mockReturnValueOnce('Omar invited you to Acme');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processWorkspaceInvite(
                send,
                data,
                false
            );

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body',
                {
                    properties: {
                        username: send.username,
                        workspaceName: data.workspaceName,
                        inviterName: data.inviterName,
                    },
                }
            );
            expect(firebaseService.sendMulticast).toHaveBeenCalledWith(
                send.notificationTokens,
                { title: 'Workspace invite', body: 'Omar invited you to Acme' }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                pushResult.failureTokens
            );
            expect(
                notificationPushQueue.sendCleanupTokens
            ).toHaveBeenCalledWith(send.userId, pushResult.failureTokens);
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Workspace invite notification processed',
                result: {
                    successCount: 1,
                    failureCount: 1,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('does not throw when cleanup enqueue rejects after markSent', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);
            notificationPushQueue.sendCleanupTokens.mockRejectedValue(
                new Error('redis down')
            );

            const result = await domain.processWorkspaceInvite(
                send,
                data,
                false
            );

            expect(notificationRepository.markSent).toHaveBeenCalled();
            expect(result).toEqual({
                message: 'Workspace invite notification processed',
                result: {
                    successCount: 1,
                    failureCount: 1,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('hands a send with no success to the failure handler', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(retryableResult);

            const promise = domain.processWorkspaceInvite(send, data, false);

            await expect(promise).rejects.toThrow(QueueException);
            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                retryableResult.failures[0].error.code,
                []
            );
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWorkspaceJoinRequest', () => {
        const data: INotificationWorkspaceJoinRequestPushPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            requesterName: 'Omar',
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join request notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                []
            );
            expect(result).toEqual({
                message:
                    'Firebase not initialized, skipping workspace join request notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Join request')
                .mockReturnValueOnce('Omar requested to join Acme');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                data,
                false
            );

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body',
                {
                    properties: {
                        username: send.username,
                        workspaceName: data.workspaceName,
                        requesterName: data.requesterName,
                    },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Workspace join request notification processed',
                result: {
                    successCount: 1,
                    failureCount: 1,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('hands a send with no success to the failure handler', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(invalidResult);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                data,
                false
            );

            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                'allTokensInvalid',
                invalidResult.failureTokens
            );
            expect(result).toEqual({
                message: 'Push delivery failed, every token is invalid',
                result: {
                    successCount: 0,
                    failureCount: 2,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });
    });

    describe('processWorkspaceJoinAccepted', () => {
        const data: INotificationWorkspaceJoinAcceptedPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join accepted notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                []
            );
            expect(result).toEqual({
                message:
                    'Firebase not initialized, skipping workspace join accepted notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Join accepted')
                .mockReturnValueOnce('You joined Acme');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body',
                {
                    properties: {
                        username: send.username,
                        workspaceName: data.workspaceName,
                    },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Workspace join accepted notification processed',
                result: {
                    successCount: 1,
                    failureCount: 1,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('hands a send with no success to the failure handler', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(permanentResult);

            const promise = domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            await expect(promise).rejects.toMatchObject({
                module: 'notification',
                statusCode: EnumNotificationStatusCodeError.deliveryFailed,
                messagePath: 'notification.error.deliveryFailed',
            });
        });
    });

    describe('processWorkspaceJoinRejected', () => {
        const data: INotificationWorkspaceJoinRejectedPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            rejectReasonCode: EnumWorkspaceJoinRejectReason.memberLimitReached,
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinRejected(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join rejected notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinRejected(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                []
            );
            expect(result).toEqual({
                message:
                    'Firebase not initialized, skipping workspace join rejected notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Workspace is full')
                .mockReturnValueOnce('Join rejected')
                .mockReturnValueOnce('Your request to join Acme was rejected');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processWorkspaceJoinRejected(
                send,
                data,
                false
            );

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                1,
                `notification.rejectReason.${data.rejectReasonCode}`
            );
            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                3,
                'body',
                {
                    properties: {
                        username: send.username,
                        workspaceName: data.workspaceName,
                        rejectReasonLabel: 'Workspace is full',
                    },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Workspace join rejected notification processed',
                result: {
                    successCount: 1,
                    failureCount: 1,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('hands a send with no success to the failure handler', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(retryableResult);

            const promise = domain.processWorkspaceJoinRejected(
                send,
                data,
                true
            );

            await expect(promise).rejects.toThrow(QueueException);
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                retryableResult.failures[0].error.code,
                retryableResult.failureTokens
            );
        });
    });
    describe('handleSendFailure', () => {
        it('marks failed with failureTokens and enqueues cleanup when every token is invalid', async () => {
            const result = await domain['handleSendFailure'](
                send.userId,
                send.notificationId,
                invalidResult,
                false
            );

            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                'allTokensInvalid',
                invalidResult.failureTokens
            );
            expect(
                notificationPushQueue.sendCleanupTokens
            ).toHaveBeenCalledWith(send.userId, invalidResult.failureTokens);
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'Push delivery failed, every token is invalid',
                result: {
                    successCount: 0,
                    failureCount: 2,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('does not throw when cleanup enqueue rejects after markFailed', async () => {
            notificationPushQueue.sendCleanupTokens.mockRejectedValue(
                new Error('redis down')
            );

            const result = await domain['handleSendFailure'](
                send.userId,
                send.notificationId,
                invalidResult,
                false
            );

            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(result).toEqual({
                message: 'Push delivery failed, every token is invalid',
                result: {
                    successCount: 0,
                    failureCount: 2,
                    errorCodes: ['messaging/registration-token-not-registered'],
                },
            });
        });

        it('marks retry on a retryable non-final failure', async () => {
            const promise = domain['handleSendFailure'](
                send.userId,
                send.notificationId,
                retryableResult,
                false
            );

            await expect(promise).rejects.toThrow(QueueException);
            await expect(promise).rejects.toMatchObject({
                message: retryableResult.failures[0].error.code,
                isFatal: true,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                retryableResult.failures[0].error.code,
                []
            );
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
        });

        it('marks failed and rethrows on a retryable final failure', async () => {
            const promise = domain['handleSendFailure'](
                send.userId,
                send.notificationId,
                retryableResult,
                true
            );

            await expect(promise).rejects.toThrow(QueueException);
            await expect(promise).rejects.toMatchObject({
                message: retryableResult.failures[0].error.code,
                isFatal: true,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                retryableResult.failures[0].error.code,
                retryableResult.failureTokens
            );
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
        });

        it('throws NotificationDeliveryFailedException on a permanent failure', async () => {
            const promise = domain['handleSendFailure'](
                send.userId,
                send.notificationId,
                permanentResult,
                false
            );

            await expect(promise).rejects.toMatchObject({
                module: 'notification',
                statusCode: EnumNotificationStatusCodeError.deliveryFailed,
                statusCodeKey:
                    EnumNotificationStatusCodeError[
                        EnumNotificationStatusCodeError.deliveryFailed
                    ],
                messagePath: 'notification.error.deliveryFailed',
                messageProperties: {
                    cause: permanentResult.failures[0].error.code,
                },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                permanentResult.failures[0].error.code,
                permanentResult.failureTokens
            );
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
        });
    });
});
