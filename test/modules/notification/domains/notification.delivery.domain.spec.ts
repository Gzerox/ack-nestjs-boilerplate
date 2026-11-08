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
    const transient: INotificationDeliveryFailure = {
        code: 'messaging/server-unavailable',
        isRetryable: true,
        retryAfterInMs: 90000,
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

    it.each([
        {
            isRetryable: true,
            isLastAttempt: false,
            expectedWrite: 'markRetry' as const,
        },
        {
            isRetryable: true,
            isLastAttempt: true,
            expectedWrite: 'markFailed' as const,
        },
        {
            isRetryable: false,
            isLastAttempt: false,
            expectedWrite: 'markFailed' as const,
        },
        {
            isRetryable: false,
            isLastAttempt: true,
            expectedWrite: 'markFailed' as const,
        },
    ])(
        'persists $expectedWrite for retryable=$isRetryable, final=$isLastAttempt before throwing a safe typed failure',
        async ({ isRetryable, isLastAttempt, expectedWrite }) => {
            const failure = { ...transient, isRetryable };
            const attempt = domain.fail(context, failure, isLastAttempt, [
                'invalid-A',
            ]);
            await expect(attempt).rejects.toBeInstanceOf(
                NotificationDeliveryFailedException
            );
            await expect(attempt).rejects.toMatchObject({
                isRetryable,
                retryAfterInMs: 90000,
                rawError: cause,
                messageProperties: { cause: 'messaging/server-unavailable' },
            });
            expect(notificationRepository[expectedWrite]).toHaveBeenCalledWith(
                'user',
                'notification',
                EnumNotificationChannel.push,
                'messaging/server-unavailable',
                ['invalid-A']
            );
            expect(
                notificationRepository[
                    expectedWrite === 'markRetry' ? 'markFailed' : 'markRetry'
                ]
            ).not.toHaveBeenCalled();
            await expect(attempt).rejects.not.toHaveProperty(
                'message',
                cause.message
            );
        }
    );

    it('does not hide a failed retry-state write behind the provider exception', async () => {
        const databaseError = new Error('state write failed');
        notificationRepository.markRetry.mockRejectedValue(databaseError);
        await expect(domain.fail(context, transient, false, [])).rejects.toBe(
            databaseError
        );
    });
});
