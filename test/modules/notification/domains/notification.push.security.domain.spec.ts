import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import type { IFirebasePushResult } from '@common/firebase/interfaces/firebase.interface';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { MessageService } from '@common/message/services/message.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import type { IRequestLog } from '@common/request/interfaces/request.interface';
import {
    EnumNotificationChannel,
    EnumUserLoginFrom,
    EnumUserLoginWith,
} from '@generated/prisma-client/client';
import { NotificationPushSecurityDomain } from '@modules/notification/domains/notification.push.security.domain';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type {
    INotificationContent,
    INotificationNewDeviceLoginPayload,
    INotificationSendPushPayload,
    INotificationTemporaryPasswordPushPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { QueueException } from '@queues/exceptions/queue.exception';

describe('NotificationPushSecurityDomain', () => {
    const firebaseService = mock<FirebaseService>();
    const notificationRepository = mock<NotificationRepository>();
    const messageService = mock<MessageService>();
    const helperDateService = mock<HelperDateService>();
    const requestContextService = mock<RequestContextService>();
    const notificationPushQueue = mock<NotificationPushQueue>();
    let domain: NotificationPushSecurityDomain;

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
                code: 'messaging/server-unavailable',
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

    it('preserves invalid A across a transient B failure and a later successful B send', async () => {
        notificationRepository.markProcessing
            .mockResolvedValueOnce({ ...content, failureTokens: [] })
            .mockResolvedValueOnce({
                ...content,
                failureTokens: ['invalid-A'],
            });
        firebaseService.isInitialized.mockReturnValue(true);
        firebaseService.sendMulticast
            .mockResolvedValueOnce({
                successCount: 0,
                failureCount: 2,
                failureTokens: ['invalid-A'],
                failures: [
                    {
                        token: 'invalid-A',
                        error: {
                            code: 'messaging/registration-token-not-registered',
                            isInvalidToken: true,
                            isRetryable: false,
                            retryAfterInMs: null,
                            cause: null,
                        },
                    },
                    {
                        token: 'transient-B',
                        error: {
                            code: 'messaging/server-unavailable',
                            isInvalidToken: false,
                            isRetryable: true,
                            retryAfterInMs: null,
                            cause: null,
                        },
                    },
                ],
            })
            .mockResolvedValueOnce({
                successCount: 1,
                failureCount: 0,
                failureTokens: [],
                failures: [],
            });
        await expect(
            domain.processResetTwoFactorByAdmin(
                { ...send, notificationTokens: ['invalid-A', 'transient-B'] },
                false
            )
        ).rejects.toBeDefined();
        expect(notificationRepository.markRetry).toHaveBeenCalledWith(
            send.userId,
            send.notificationId,
            EnumNotificationChannel.push,
            'messaging/server-unavailable',
            ['invalid-A']
        );
        await domain.processResetTwoFactorByAdmin(
            { ...send, notificationTokens: ['transient-B'] },
            false
        );
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            send.userId,
            send.notificationId,
            EnumNotificationChannel.push,
            ['invalid-A']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            send.userId,
            ['invalid-A']
        );
    });

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushSecurityDomain,
                { provide: FirebaseService, useValue: firebaseService },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                { provide: MessageService, useValue: messageService },
                { provide: HelperDateService, useValue: helperDateService },
                {
                    provide: RequestContextService,
                    useValue: requestContextService,
                },
                {
                    provide: NotificationPushQueue,
                    useValue: notificationPushQueue,
                },
            ],
        }).compile();
        domain = module.get(NotificationPushSecurityDomain);
    });

    describe('processNewDeviceLogin', () => {
        const requestLog: IRequestLog = {
            userAgent: {
                ua: 'Mozilla/5.0',
                browser: null,
                cpu: null,
                device: null,
                engine: null,
                os: null,
            },
            ipAddress: '203.0.113.5',
            geoLocation: {
                latitude: 1,
                longitude: 2,
                country: 'US',
                region: 'CA',
                city: 'San Francisco',
            },
        };
        const data: INotificationNewDeviceLoginPayload = {
            loginFrom: EnumUserLoginFrom.website,
            loginWith: EnumUserLoginWith.credential,
            loginAt: '2024-01-01T00:00:00.000Z',
            requestLog,
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processNewDeviceLogin(
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
                    'Delivery already sent or missing, skipping new login notification',
            });
            expect(firebaseService.isInitialized).not.toHaveBeenCalled();
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processNewDeviceLogin(
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
                    'Firebase not initialized, skipping new login notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue({
                failureTokens: [],
                title: 'notification.title.newDeviceLogin',
                body: 'notification.body.newDeviceLogin',
            });
            firebaseService.isInitialized.mockReturnValue(true);
            requestContextService.resolveDevice.mockReturnValue(
                'Chrome on macOS'
            );
            requestContextService.resolveCity.mockReturnValue('San Francisco');
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
                date.toISOString()
            );
            messageService.setMessage
                .mockReturnValueOnce('New login')
                .mockReturnValueOnce('New login from Chrome on macOS');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processNewDeviceLogin(
                send,
                data,
                false
            );

            expect(requestContextService.resolveDevice).toHaveBeenCalledWith(
                requestLog.userAgent
            );
            expect(requestContextService.resolveCity).toHaveBeenCalledWith(
                requestLog.geoLocation
            );
            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                1,
                'notification.title.newDeviceLogin'
            );
            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'notification.body.newDeviceLogin',
                {
                    properties: {
                        device: 'Chrome on macOS',
                        city: 'San Francisco',
                        username: send.username,
                        loginAt: data.loginAt,
                    },
                }
            );
            expect(firebaseService.sendMulticast).toHaveBeenCalledWith(
                send.notificationTokens,
                { title: 'New login', body: 'New login from Chrome on macOS' }
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
                message: 'New login notification processed',
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
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
                date.toISOString()
            );
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);
            notificationPushQueue.sendCleanupTokens.mockRejectedValue(
                new Error('redis down')
            );

            const result = await domain.processNewDeviceLogin(
                send,
                data,
                false
            );

            expect(notificationRepository.markSent).toHaveBeenCalled();
            expect(result).toEqual({
                message: 'New login notification processed',
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
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
                date.toISOString()
            );
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(retryableResult);

            const promise = domain.processNewDeviceLogin(send, data, false);

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

    describe('processResetTwoFactorByAdmin', () => {
        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processResetTwoFactorByAdmin(
                send,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping reset two-factor notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processResetTwoFactorByAdmin(
                send,
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
                    'Firebase not initialized, skipping reset two-factor notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Two-factor reset')
                .mockReturnValueOnce('Your two-factor was reset');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processResetTwoFactorByAdmin(
                send,
                false
            );

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body',
                {
                    properties: { username: send.username },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                pushResult.failureTokens
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Reset two-factor notification processed',
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

            const result = await domain.processResetTwoFactorByAdmin(
                send,
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

    describe('processTemporaryPasswordByAdmin', () => {
        const data: INotificationTemporaryPasswordPushPayload = {
            passwordExpiredAt: '2024-02-01T00:00:00.000Z',
            passwordCreatedAt: '2024-01-01T00:00:00.000Z',
        };

        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processTemporaryPasswordByAdmin(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping temporary password notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processTemporaryPasswordByAdmin(
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
                    'Firebase not initialized, skipping temporary password notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
                date.toISOString()
            );
            messageService.setMessage
                .mockReturnValueOnce('Temporary password')
                .mockReturnValueOnce('Your temporary password expires soon');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processTemporaryPasswordByAdmin(
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
                        passwordExpiredAt: data.passwordExpiredAt,
                    },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Temporary password notification processed',
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
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
                date.toISOString()
            );
            messageService.setMessage.mockReturnValue('text');
            firebaseService.sendMulticast.mockResolvedValue(permanentResult);

            const promise = domain.processTemporaryPasswordByAdmin(
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

    describe('processResetPassword', () => {
        it('skips when markProcessing returns null', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processResetPassword(send, false);

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping reset password notification',
            });
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        });

        it('marks skipped when Firebase is not initialized', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(false);

            const result = await domain.processResetPassword(send, false);

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.push,
                []
            );
            expect(result).toEqual({
                message:
                    'Firebase not initialized, skipping reset password notification',
            });
        });

        it('marks sent before enqueueing token cleanup', async () => {
            notificationRepository.markProcessing.mockResolvedValue(content);
            firebaseService.isInitialized.mockReturnValue(true);
            messageService.setMessage
                .mockReturnValueOnce('Reset password')
                .mockReturnValueOnce('Your password was reset');
            firebaseService.sendMulticast.mockResolvedValue(pushResult);

            const result = await domain.processResetPassword(send, false);

            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body',
                {
                    properties: { username: send.username },
                }
            );
            expect(notificationRepository.markSent).toHaveBeenCalledBefore(
                notificationPushQueue.sendCleanupTokens
            );
            expect(result).toEqual({
                message: 'Reset password notification processed',
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

            const promise = domain.processResetPassword(send, true);

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
