import { AppErrorCode, FirebaseAppError } from 'firebase-admin/app';
import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { FirebaseService } from '@common/firebase/services/firebase.service';
import type { IFirebaseDeliveryError } from '@common/firebase/interfaces/firebase.interface';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';

describe('NotificationPushDeliveryDomain', () => {
    const firebaseService = mock<FirebaseService>();
    const messageService = mock<MessageService>();
    const notificationRepository = mock<NotificationRepository>();
    const notificationPushQueue = mock<NotificationPushQueue>();
    const send = {
        userId: 'user',
        notificationId: 'notification',
        username: 'name',
        notificationTokens: ['good', 'transient', 'invalid', 'permanent'],
    };
    const content = {
        title: 'title.key',
        body: 'body.key',
        failureTokens: [] as string[],
    };
    const cause = new Error('private provider detail');
    const transient: IFirebaseDeliveryError = {
        code: 'messaging/server-unavailable',
        isRetryable: true,
        isInvalidToken: false,
        retryAfterInMs: null,
        cause,
    };
    const invalid: IFirebaseDeliveryError = {
        code: 'messaging/registration-token-not-registered',
        isRetryable: false,
        isInvalidToken: true,
        retryAfterInMs: null,
        cause,
    };
    const permanent: IFirebaseDeliveryError = {
        code: 'messaging/invalid-argument',
        isRetryable: false,
        isInvalidToken: false,
        retryAfterInMs: null,
        cause,
    };
    const failures = [
        { token: 'transient', error: transient },
        { token: 'invalid', error: invalid },
        { token: 'permanent', error: permanent },
    ];
    let domain: NotificationPushDeliveryDomain;
    beforeEach(async () => {
        vi.resetAllMocks();
        firebaseService.isInitialized.mockReturnValue(true);
        notificationRepository.markProcessing.mockResolvedValue(content);
        messageService.setMessage
            .mockReturnValueOnce('title')
            .mockReturnValueOnce('body');
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushDeliveryDomain,
                NotificationDeliveryDomain,
                { provide: FirebaseService, useValue: firebaseService },
                { provide: MessageService, useValue: messageService },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                {
                    provide: NotificationPushQueue,
                    useValue: notificationPushQueue,
                },
            ],
        }).compile();
        domain = module.get(NotificationPushDeliveryDomain);
    });
    it.each([false, true])(
        'completes after partial acceptance without retry, final=%s',
        async isLastAttempt => {
            const writes: string[] = [];
            notificationRepository.markSent.mockImplementation(async () => {
                writes.push('sent');
            });
            notificationPushQueue.sendCleanupTokens.mockImplementation(
                async () => {
                    writes.push('cleanup');
                }
            );
            firebaseService.sendMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 3,
                failureTokens: ['invalid'],
                failures,
            });
            expect(
                await domain.send(send, { username: 'name' }, isLastAttempt)
            ).toEqual({
                outcome: 'completed',
                summary: {
                    acceptedCount: 1,
                    failedCount: 3,
                    invalidTargetCount: 1,
                    errorCodes: [
                        'messaging/server-unavailable',
                        'messaging/registration-token-not-registered',
                        'messaging/invalid-argument',
                    ],
                },
            });
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                'user',
                'notification',
                EnumNotificationChannel.push,
                ['invalid']
            );
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
            expect(
                notificationPushQueue.sendCleanupTokens
            ).toHaveBeenCalledWith('user', ['invalid']);
            expect(writes).toEqual(['sent', 'cleanup']);
            expect(messageService.setMessage).toHaveBeenNthCalledWith(
                2,
                'body.key',
                { properties: { username: 'name' } }
            );
        }
    );
    it('returns only transient targets after zero acceptance, retaining invalid history and the longest retry hint', async () => {
        notificationRepository.markProcessing.mockResolvedValue({
            ...content,
            failureTokens: ['old-invalid'],
        });
        const throttled = {
            ...transient,
            code: 'messaging/message-rate-exceeded',
            retryAfterInMs: 90000,
        };
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 4,
            failureTokens: ['invalid'],
            failures: [...failures, { token: 'throttled', error: throttled }],
        });
        const result = await domain.send(
            {
                ...send,
                notificationTokens: [
                    'transient',
                    'invalid',
                    'permanent',
                    'throttled',
                ],
            },
            {},
            false
        );
        expect(result).toMatchObject({
            outcome: 'retry',
            retryTargets: ['transient', 'throttled'],
            failure: {
                code: 'messaging/message-rate-exceeded',
                retryAfterInMs: 90000,
                cause,
            },
        });
        expect(notificationRepository.markRetry).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            'messaging/message-rate-exceeded',
            ['old-invalid', 'invalid']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            'user',
            ['old-invalid', 'invalid']
        );
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
    });
    it.each([false, true])(
        'permanent-only failure keeps otherwise valid tokens, final=%s',
        async isLastAttempt => {
            firebaseService.sendMulticast.mockResolvedValue({
                successCount: 0,
                failureCount: 1,
                failureTokens: [],
                failures: [{ token: 'valid', error: permanent }],
            });
            const result = domain.send(
                { ...send, notificationTokens: ['valid'] },
                {},
                isLastAttempt
            );
            await expect(result).rejects.toBeInstanceOf(
                NotificationDeliveryFailedException
            );
            await expect(result).rejects.toMatchObject({
                isRetryable: false,
                rawError: cause,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                'user',
                'notification',
                EnumNotificationChannel.push,
                'messaging/invalid-argument',
                []
            );
            expect(
                notificationPushQueue.sendCleanupTokens
            ).not.toHaveBeenCalled();
        }
    );
    it('persists final transient exhaustion before cleaning only invalid tokens and throwing', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 3,
            failureTokens: ['invalid'],
            failures,
        });
        await expect(domain.send(send, {}, true)).rejects.toMatchObject({
            isRetryable: true,
            rawError: cause,
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            'messaging/server-unavailable',
            ['invalid']
        );
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            'user',
            ['invalid']
        );
    });
    it('skips all-invalid targets without raising a provider incident', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 1,
            failureTokens: ['invalid'],
            failures: [{ token: 'invalid', error: invalid }],
        });
        expect(
            await domain.send(
                { ...send, notificationTokens: ['invalid'] },
                {},
                false
            )
        ).toMatchObject({
            outcome: 'completed',
            summary: {
                acceptedCount: 0,
                failedCount: 1,
                invalidTargetCount: 1,
            },
        });
        expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid']
        );
        expect(notificationRepository.markFailed).not.toHaveBeenCalled();
    });
    it.each([
        { notificationTokens: [] },
        { notificationTokens: ['old-invalid'] },
    ])(
        'skips when no eligible targets remain: $notificationTokens',
        async ({ notificationTokens }) => {
            notificationRepository.markProcessing.mockResolvedValue({
                ...content,
                failureTokens: ['old-invalid'],
            });
            expect(
                await domain.send({ ...send, notificationTokens }, {}, false)
            ).toEqual({
                outcome: 'completed',
                summary: {
                    acceptedCount: 0,
                    failedCount: 0,
                    invalidTargetCount: 0,
                    errorCodes: [],
                },
            });
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                'user',
                'notification',
                EnumNotificationChannel.push,
                ['old-invalid']
            );
            expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        }
    );
    it('does not send or mutate after a terminal/missing claim', async () => {
        notificationRepository.markProcessing.mockResolvedValue(null);
        await domain.send(send, {}, false);
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(messageService.setMessage).not.toHaveBeenCalled();
    });
    it('skips a disabled provider while preserving invalid history', async () => {
        notificationRepository.markProcessing.mockResolvedValue({
            ...content,
            failureTokens: ['old-invalid'],
        });
        firebaseService.isInitialized.mockReturnValue(false);
        await domain.send(send, {}, false);
        expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['old-invalid']
        );
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
    });
    it('deduplicates tokens and excludes stored invalid ones before sending', async () => {
        notificationRepository.markProcessing.mockResolvedValue({
            ...content,
            failureTokens: ['old-invalid'],
        });
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            failureTokens: [],
            failures: [],
        });
        await domain.send(
            { ...send, notificationTokens: ['old-invalid', 'good', 'good'] },
            {},
            false
        );
        expect(firebaseService.sendMulticast).toHaveBeenCalledWith(['good'], {
            title: 'title',
            body: 'body',
        });
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['old-invalid']
        );
    });
    it('does not retry accepted sends when cleanup rejects', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            failureTokens: ['invalid'],
            failures: [{ token: 'invalid', error: invalid }],
        });
        notificationPushQueue.sendCleanupTokens.mockRejectedValue(
            new Error('cleanup unavailable')
        );
        await expect(domain.send(send, {}, false)).resolves.toMatchObject({
            outcome: 'completed',
            summary: { acceptedCount: 1 },
        });
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
    });
    it('does not hide a failed state write or enqueue cleanup before it', async () => {
        const writeError = new Error('database unavailable');
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            failureTokens: ['invalid'],
            failures: [{ token: 'invalid', error: invalid }],
        });
        notificationRepository.markSent.mockRejectedValue(writeError);
        await expect(domain.send(send, {}, false)).rejects.toBe(writeError);
        expect(notificationPushQueue.sendCleanupTokens).not.toHaveBeenCalled();
    });
    it('classifies a whole-call provider rejection for every eligible target', async () => {
        const error = new FirebaseAppError({
            code: AppErrorCode.NETWORK_TIMEOUT,
            message: 'timeout',
        });
        firebaseService.sendMulticast.mockRejectedValue(error);
        firebaseService.classifyError.mockReturnValue({
            ...transient,
            code: 'app/network-timeout',
            cause: error,
        });
        await expect(domain.send(send, {}, false)).resolves.toMatchObject({
            outcome: 'retry',
            retryTargets: send.notificationTokens,
            failure: { cause: error },
        });
    });
    it('treats local rendering errors as permanent without sending', async () => {
        const error = new Error('render private detail');
        messageService.setMessage.mockReset().mockImplementation(() => {
            throw error;
        });
        await expect(domain.send(send, {}, false)).rejects.toMatchObject({
            isRetryable: false,
            rawError: error,
            messageProperties: { cause: 'renderFailed' },
        });
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
    });
    it('preserves invalid A through a narrowed retry of B and its eventual success', async () => {
        notificationRepository.markProcessing
            .mockResolvedValueOnce(content)
            .mockResolvedValueOnce({
                ...content,
                failureTokens: ['invalid-A'],
            });
        messageService.setMessage.mockReset().mockReturnValue('translated');
        firebaseService.sendMulticast
            .mockResolvedValueOnce({
                successCount: 0,
                failureCount: 2,
                failureTokens: ['invalid-A'],
                failures: [
                    { token: 'invalid-A', error: invalid },
                    { token: 'B', error: transient },
                ],
            })
            .mockResolvedValueOnce({
                successCount: 1,
                failureCount: 0,
                failureTokens: [],
                failures: [],
            });
        const first = await domain.send(
            { ...send, notificationTokens: ['invalid-A', 'B'] },
            {},
            false
        );
        expect(first).toMatchObject({ outcome: 'retry', retryTargets: ['B'] });
        expect(notificationRepository.markRetry).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            'messaging/server-unavailable',
            ['invalid-A']
        );
        const retryTargets =
            first.outcome === 'retry' ? first.retryTargets : [];
        await expect(
            domain.send(
                { ...send, notificationTokens: retryTargets },
                {},
                false
            )
        ).resolves.toMatchObject({
            outcome: 'completed',
            summary: { acceptedCount: 1 },
        });
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid-A']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenNthCalledWith(
            1,
            'user',
            ['invalid-A']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenNthCalledWith(
            2,
            'user',
            ['invalid-A']
        );
    });
    it('cleans only invalid tokens when the remaining failures are permanent', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 2,
            failureTokens: ['invalid'],
            failures: [
                { token: 'invalid', error: invalid },
                { token: 'permanent', error: permanent },
            ],
        });
        await expect(
            domain.send(
                { ...send, notificationTokens: ['invalid', 'permanent'] },
                {},
                false
            )
        ).rejects.toMatchObject({ isRetryable: false });
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            'user',
            ['invalid']
        );
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
    });
});
