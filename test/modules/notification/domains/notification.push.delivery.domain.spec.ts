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
        isInvalidToken: false,
        cause,
    };
    const invalid: IFirebaseDeliveryError = {
        code: 'messaging/registration-token-not-registered',
        isInvalidToken: true,
        cause,
    };
    const permanent: IFirebaseDeliveryError = {
        code: 'messaging/invalid-argument',
        isInvalidToken: false,
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
        notificationRepository.findForDelivery.mockResolvedValue(content);
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
    it('completes after partial acceptance, cleaning invalid tokens after the state write', async () => {
        const writes: string[] = [];
        notificationRepository.markSent.mockImplementation(async () => {
            writes.push('sent');
        });
        notificationPushQueue.sendCleanupTokens.mockImplementation(async () => {
            writes.push('cleanup');
        });
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 3,
            failureTokens: ['invalid'],
            failures,
        });
        expect(await domain.send(send, { username: 'name' })).toEqual({
            acceptedCount: 1,
            failedCount: 3,
            invalidTargetCount: 1,
            errorCodes: [
                'messaging/server-unavailable',
                'messaging/registration-token-not-registered',
                'messaging/invalid-argument',
            ],
        });
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            'user',
            ['invalid']
        );
        expect(writes).toEqual(['sent', 'cleanup']);
        expect(messageService.setMessage).toHaveBeenNthCalledWith(
            2,
            'body.key',
            { properties: { username: 'name' } }
        );
    });
    it('marks failed and throws after zero acceptance, retaining invalid history', async () => {
        notificationRepository.findForDelivery.mockResolvedValue({
            ...content,
            failureTokens: ['old-invalid'],
        });
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 3,
            failureTokens: ['invalid'],
            failures,
        });
        const result = domain.send(send, {});
        await expect(result).rejects.toBeInstanceOf(
            NotificationDeliveryFailedException
        );
        await expect(result).rejects.toMatchObject({
            rawError: cause,
            messageProperties: { cause: 'messaging/server-unavailable' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['old-invalid', 'invalid']
        );
        expect(notificationPushQueue.sendCleanupTokens).toHaveBeenCalledWith(
            'user',
            ['old-invalid', 'invalid']
        );
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
    });
    it('a permanent-only failure keeps otherwise valid tokens and creates no cleanup', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 1,
            failureTokens: [],
            failures: [{ token: 'valid', error: permanent }],
        });
        const result = domain.send(
            { ...send, notificationTokens: ['valid'] },
            {}
        );
        await expect(result).rejects.toBeInstanceOf(
            NotificationDeliveryFailedException
        );
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            []
        );
        expect(notificationPushQueue.sendCleanupTokens).not.toHaveBeenCalled();
    });
    it('skips all-invalid targets without raising a provider incident', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 1,
            failureTokens: ['invalid'],
            failures: [{ token: 'invalid', error: invalid }],
        });
        expect(
            await domain.send({ ...send, notificationTokens: ['invalid'] }, {})
        ).toMatchObject({
            acceptedCount: 0,
            failedCount: 1,
            invalidTargetCount: 1,
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
            notificationRepository.findForDelivery.mockResolvedValue({
                ...content,
                failureTokens: ['old-invalid'],
            });
            expect(
                await domain.send({ ...send, notificationTokens }, {})
            ).toEqual({
                acceptedCount: 0,
                failedCount: 0,
                invalidTargetCount: 0,
                errorCodes: [],
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
        notificationRepository.findForDelivery.mockResolvedValue(null);
        await domain.send(send, {});
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(messageService.setMessage).not.toHaveBeenCalled();
    });
    it('does nothing when the provider is disabled', async () => {
        firebaseService.isInitialized.mockReturnValue(false);
        expect(await domain.send(send, {})).toEqual({
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        });
        expect(notificationRepository.findForDelivery).not.toHaveBeenCalled();
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
    });
    it('deduplicates tokens and excludes stored invalid ones before sending', async () => {
        notificationRepository.findForDelivery.mockResolvedValue({
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
            {}
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
    it('does not fail an accepted send when cleanup rejects', async () => {
        firebaseService.sendMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            failureTokens: ['invalid'],
            failures: [{ token: 'invalid', error: invalid }],
        });
        notificationPushQueue.sendCleanupTokens.mockRejectedValue(
            new Error('cleanup unavailable')
        );
        await expect(domain.send(send, {})).resolves.toMatchObject({
            acceptedCount: 1,
        });
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
        await expect(domain.send(send, {})).rejects.toBe(writeError);
        expect(notificationPushQueue.sendCleanupTokens).not.toHaveBeenCalled();
    });
    it('marks failed and throws when the whole provider call rejects', async () => {
        const error = new FirebaseAppError({
            code: AppErrorCode.NETWORK_TIMEOUT,
            message: 'timeout',
        });
        firebaseService.sendMulticast.mockRejectedValue(error);
        firebaseService.classifyError.mockReturnValue({
            code: 'app/network-timeout',
            isInvalidToken: false,
            cause: error,
        });
        const result = domain.send(send, {});
        await expect(result).rejects.toMatchObject({
            rawError: error,
            messageProperties: { cause: 'app/network-timeout' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            []
        );
    });
    it('marks failed and throws on a local rendering error without sending', async () => {
        const error = new Error('render private detail');
        messageService.setMessage.mockReset().mockImplementation(() => {
            throw error;
        });
        await expect(domain.send(send, {})).rejects.toMatchObject({
            rawError: error,
            messageProperties: { cause: 'renderFailed' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalled();
        expect(firebaseService.sendMulticast).not.toHaveBeenCalled();
    });
    it('keeps invalid A across a failed attempt and the retried success', async () => {
        notificationRepository.findForDelivery
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
        const retried = { ...send, notificationTokens: ['invalid-A', 'B'] };
        await expect(domain.send(retried, {})).rejects.toBeInstanceOf(
            NotificationDeliveryFailedException
        );
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid-A']
        );
        await expect(domain.send(retried, {})).resolves.toMatchObject({
            acceptedCount: 1,
        });
        expect(firebaseService.sendMulticast).toHaveBeenNthCalledWith(
            2,
            ['B'],
            { title: 'translated', body: 'translated' }
        );
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push,
            ['invalid-A']
        );
    });
});
