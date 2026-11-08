import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { DeviceDomain } from '@modules/device/domains/device.domain';
import { NotificationKindContract } from '@modules/notification/contracts/notification.kind.contract';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import type {
    INotificationEmailSendPayload,
    INotificationForgotPasswordEncryptedPayload,
    INotificationNewDeviceLoginPayload,
    INotificationSendPushPayload,
    INotificationTemporaryPasswordEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationEmailQueue } from '@modules/notification/queues/notification.email.queue';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { UserDomain } from '@modules/user/domains/user.domain';
import { Injectable } from '@nestjs/common';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Writes and fans out the password, two-factor and new-device login notifications. */
@Injectable()
export class NotificationSecurityDomain {
    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly userDomain: UserDomain,
        private readonly deviceDomain: DeviceDomain,
        private readonly helperDateService: HelperDateService,
        private readonly requestContextService: RequestContextService,
        private readonly databaseUtil: DatabaseUtil,
        private readonly notificationEmailQueue: NotificationEmailQueue,
        private readonly notificationPushQueue: NotificationPushQueue
    ) {}

    async processTemporaryPasswordByAdmin(
        userId: string,
        proceedBy: string,
        data: INotificationTemporaryPasswordEncryptedPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping temporary password by admin notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };
        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        const passwordExpiredAt = this.helperDateService.createFromIso(
            data.passwordExpiredAt
        );

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.temporaryPasswordByAdmin,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    passwordExpiredAt,
                },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[
                EnumNotificationKind.temporaryPasswordByAdmin
            ].pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendTemporaryPasswordByAdmin(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendTemporaryPasswordByAdmin(
                        pushPayload,
                        {
                            passwordCreatedAt: data.passwordCreatedAt,
                            passwordExpiredAt: data.passwordExpiredAt,
                        }
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Temporary password by admin notification processed',
            results,
        };
    }

    async processChangePassword(userId: string): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message:
                    'User not found, skipping change password notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.changePassword,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.changePassword]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendChangePassword(emailPayload);
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Change password notification processed', results };
    }

    async processForgotPassword(
        userId: string,
        data: INotificationForgotPasswordEncryptedPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message:
                    'User not found, skipping forgot password notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.forgotPassword,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.forgotPassword]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise = this.notificationEmailQueue.sendForgotPassword(
                emailPayload,
                data
            );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            const skipped = this.notificationRepository.markSkipped(
                user.id,
                notificationId,
                EnumNotificationChannel.push,
                []
            );
            promises.push(skipped);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Forgot password notification processed', results };
    }

    async processResetPassword(userId: string): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message: 'User not found, skipping reset password notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };
        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.resetPassword,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.resetPassword]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendResetPassword(emailPayload);
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendResetPassword(pushPayload);
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Reset password notification processed', results };
    }

    async processResetTwoFactorByAdmin(
        userId: string,
        proceedBy: string
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping reset two factor by admin notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };
        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.resetTwoFactorByAdmin,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.resetTwoFactorByAdmin]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendResetTwoFactorByAdmin(
                    emailPayload
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendResetTwoFactorByAdmin(
                        pushPayload
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Reset two factor by admin notification processed',
            results,
        };
    }

    async processNewDeviceLogin(
        userId: string,
        data: INotificationNewDeviceLoginPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping new device login notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };
        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);
        const device = this.requestContextService.resolveDevice(
            data.requestLog.userAgent
        );
        const city = this.requestContextService.resolveCity(
            data.requestLog.geoLocation
        );

        const loginAt = this.helperDateService.createFromIso(data.loginAt);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.newDeviceLogin,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    loginFrom: data.loginFrom,
                    loginWith: data.loginWith,
                    device,
                    city,
                    loginAt,
                },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.newDeviceLogin]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise = this.notificationEmailQueue.sendNewDeviceLogin(
                emailPayload,
                data
            );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendNewDeviceLogin(
                        pushPayload,
                        data
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'New device login notification processed', results };
    }
}
