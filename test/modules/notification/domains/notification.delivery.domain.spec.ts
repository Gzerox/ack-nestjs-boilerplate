import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import type {
    INotificationDeliveryContext,
    INotificationDeliveryFailure,
} from '@modules/notification/interfaces/notification.interface';

describe('NotificationDeliveryDomain', () => {
    const notificationRepository = mock<NotificationRepository>();
    const context: INotificationDeliveryContext = {
        userId: 'user',
        notificationId: 'notification',
        channel: EnumNotificationChannel.push,
    };
    const content = {
        title: 'title',
        body: 'body',
        failureTokens: ['invalid-A'],
    };
    const cause = new Error('provider detail containing a secret');
    const failureReport: INotificationDeliveryFailure = {
        code: 'messaging/server-unavailable',
        cause,
    };
    let domain: NotificationDeliveryDomain;

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationDeliveryDomain,
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
            ],
        }).compile();
        domain = module.get(NotificationDeliveryDomain);
    });

    it('returns only eligible content, preserving invalid-token history', async () => {
        notificationRepository.findForDelivery.mockResolvedValue(content);
        expect(await domain.begin(context)).toEqual(content);
        expect(notificationRepository.findForDelivery).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.push
        );
    });

    it('does not mutate a terminal or missing delivery when no claim is returned', async () => {
        notificationRepository.findForDelivery.mockResolvedValue(null);
        expect(await domain.begin(context)).toBeNull();
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
    });

    it('persists markFailed before throwing a safe typed failure', async () => {
        const attempt = domain.fail(context, failureReport, ['invalid-A']);
        await expect(attempt).rejects.toBeInstanceOf(
            NotificationDeliveryFailedException
        );
        await expect(attempt).rejects.toMatchObject({
            rawError: cause,
            messageProperties: { cause: 'messaging/server-unavailable' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            context.userId,
            context.notificationId,
            context.channel,
            ['invalid-A']
        );
        await expect(attempt).rejects.not.toHaveProperty(
            'message',
            cause.message
        );
    });

    it('marks an email delivery sent when the provider returned a message id', async () => {
        const isSent = await domain.completeEmail('user', 'notification', 'id');
        expect(isSent).toBe(true);
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.email,
            []
        );
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
    });

    it('leaves an email delivery pending when the provider returned no message id', async () => {
        const isSent = await domain.completeEmail('user', 'notification', null);
        expect(isSent).toBe(false);
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
        expect(notificationRepository.markFailed).not.toHaveBeenCalled();
    });

    it('does not hide a failed state write behind the provider exception', async () => {
        const databaseError = new Error('state write failed');
        notificationRepository.markFailed.mockRejectedValue(databaseError);
        await expect(domain.fail(context, failureReport, [])).rejects.toBe(
            databaseError
        );
    });
});
