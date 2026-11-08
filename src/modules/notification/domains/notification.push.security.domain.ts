import { Injectable } from '@nestjs/common';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import type {
    INotificationDeliveryAttempt,
    INotificationNewDeviceLoginPayload,
    INotificationSendPushPayload,
    INotificationTemporaryPasswordPushPayload,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationPushSecurityDomain {
    constructor(
        private readonly notificationPushDeliveryDomain: NotificationPushDeliveryDomain,
        private readonly helperDateService: HelperDateService,
        private readonly requestContextService: RequestContextService
    ) {}
    async processNewDeviceLogin(
        send: INotificationSendPushPayload,
        data: INotificationNewDeviceLoginPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const device = this.requestContextService.resolveDevice(
            data.requestLog.userAgent
        );
        const city = this.requestContextService.resolveCity(
            data.requestLog.geoLocation
        );
        const loginAtDate = this.helperDateService.createFromIso(data.loginAt);
        const loginAt = this.helperDateService.formatToRFC2822(loginAtDate);
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            { device, city, username: send.username, loginAt },
            isLastAttempt
        );
        return attempt;
    }
    async processResetTwoFactorByAdmin(
        send: INotificationSendPushPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            { username: send.username },
            isLastAttempt
        );
        return attempt;
    }
    async processTemporaryPasswordByAdmin(
        send: INotificationSendPushPayload,
        data: INotificationTemporaryPasswordPushPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const expiredAt = this.helperDateService.createFromIso(
            data.passwordExpiredAt
        );
        const passwordExpiredAt =
            this.helperDateService.formatToRFC2822(expiredAt);
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            { username: send.username, passwordExpiredAt },
            isLastAttempt
        );
        return attempt;
    }
    async processResetPassword(
        send: INotificationSendPushPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            { username: send.username },
            isLastAttempt
        );
        return attempt;
    }
}
