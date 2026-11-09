import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import {
    EnumUserLoginFrom,
    EnumUserLoginWith,
} from '@generated/prisma-client/client';
import { NotificationPushSecurityDomain } from '@modules/notification/domains/notification.push.security.domain';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import type {
    INotificationDeliverySummary,
    INotificationNewDeviceLoginPayload,
} from '@modules/notification/interfaces/notification.interface';

describe('NotificationPushSecurityDomain', () => {
    const notificationPushDeliveryDomain =
        mock<NotificationPushDeliveryDomain>();
    const helperDateService = mock<HelperDateService>();
    const requestContextService = mock<RequestContextService>();
    const send = {
        userId: 'user',
        notificationId: 'notification',
        username: 'name',
        notificationTokens: ['token'],
    };
    const completed: INotificationDeliverySummary = {
        acceptedCount: 1,
        failedCount: 0,
        invalidTargetCount: 0,
        errorCodes: [],
    };
    const date = new Date('2026-11-08T12:00:00Z');
    let domain: NotificationPushSecurityDomain;
    beforeEach(async () => {
        vi.resetAllMocks();
        notificationPushDeliveryDomain.send.mockResolvedValue(completed);
        helperDateService.createFromIso.mockReturnValue(date);
        helperDateService.formatToRFC2822.mockReturnValue('formatted date');
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushSecurityDomain,
                {
                    provide: NotificationPushDeliveryDomain,
                    useValue: notificationPushDeliveryDomain,
                },
                { provide: HelperDateService, useValue: helperDateService },
                {
                    provide: RequestContextService,
                    useValue: requestContextService,
                },
            ],
        }).compile();
        domain = module.get(NotificationPushSecurityDomain);
    });
    it('prepares login device, city and date properties and forwards the attempt result', async () => {
        const data: INotificationNewDeviceLoginPayload = {
            loginFrom: EnumUserLoginFrom.website,
            loginWith: EnumUserLoginWith.credential,
            loginAt: date.toISOString(),
            requestLog: {
                userAgent: {
                    ua: null,
                    browser: null,
                    cpu: null,
                    device: null,
                    engine: null,
                    os: null,
                },
                ipAddress: null,
                geoLocation: null,
            },
        };
        requestContextService.resolveDevice.mockReturnValue('browser');
        requestContextService.resolveCity.mockReturnValue('city');
        expect(await domain.processNewDeviceLogin(send, data)).toBe(completed);
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            device: 'browser',
            city: 'city',
            loginAt: 'formatted date',
        });
        expect(helperDateService.createFromIso).toHaveBeenCalledWith(
            data.loginAt
        );
    });
    it('prepares only the safe expiry properties for temporary passwords', async () => {
        const data = {
            passwordCreatedAt: date.toISOString(),
            passwordExpiredAt: date.toISOString(),
        };
        await domain.processTemporaryPasswordByAdmin(send, data);
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            passwordExpiredAt: 'formatted date',
        });
        expect(helperDateService.createFromIso).toHaveBeenCalledWith(
            data.passwordExpiredAt
        );
    });
    it('delegates two-factor reset with username and username', async () => {
        await domain.processResetTwoFactorByAdmin(send);
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
        });
    });
    it('delegates password reset with username and username', async () => {
        await domain.processResetPassword(send);
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
        });
    });
});
