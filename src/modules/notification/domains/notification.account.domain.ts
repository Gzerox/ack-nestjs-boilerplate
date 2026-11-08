import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationKindContract } from '@modules/notification/contracts/notification.kind.contract';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import type {
    INotificationEmailSendPayload,
    INotificationVerificationEmailEncryptedPayload,
    INotificationVerifiedEmailPayload,
    INotificationVerifiedMobileNumberPayload,
    INotificationWelcomeByAdminEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationEmailQueue } from '@modules/notification/queues/notification.email.queue';
import { UserDomain } from '@modules/user/domains/user.domain';
import { Injectable } from '@nestjs/common';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Writes and fans out the sign-up, welcome and verification notifications. */
@Injectable()
export class NotificationAccountDomain {
    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly userDomain: UserDomain,
        private readonly helperStringService: HelperStringService,
        private readonly databaseUtil: DatabaseUtil,
        private readonly notificationEmailQueue: NotificationEmailQueue
    ) {}

    async processWelcomeByAdmin(
        userId: string,
        proceedBy: string,
        data: INotificationWelcomeByAdminEncryptedPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message:
                    'User not found, skipping welcome by admin notification',
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
            EnumNotificationKind.welcomeByAdmin,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.welcomeByAdmin]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise = this.notificationEmailQueue.sendWelcomeByAdmin(
                emailPayload,
                data
            );
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Welcome by admin notification processed', results };
    }

    async processWelcome(
        userId: string,
        data: INotificationVerificationEmailEncryptedPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return { message: 'User not found, skipping welcome notification' };
        }

        const welcomeNotificationId = this.databaseUtil.createId();
        const welcomePayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId: welcomeNotificationId,
        };

        const verificationEmailNotificationId = this.databaseUtil.createId();
        const verificationEmailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId: verificationEmailNotificationId,
        };

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.createMany([
            {
                kind: EnumNotificationKind.welcome,
                payload: {
                    id: welcomeNotificationId,
                    userId: user.id,
                    metadata: { username: user.username },
                    createdBy: user.id,
                },
            },
            {
                kind: EnumNotificationKind.verificationEmail,
                payload: {
                    id: verificationEmailNotificationId,
                    userId: user.id,
                    metadata: { username: user.username },
                    createdBy: user.id,
                },
            },
        ]);

        const promises: Promise<void>[] = [];
        const welcomeChannels =
            NotificationKindContract[EnumNotificationKind.welcome]
                .pendingChannels;
        if (welcomeChannels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWelcome(welcomePayload);
            promises.push(emailPromise);
        }
        const verificationEmailChannels =
            NotificationKindContract[EnumNotificationKind.verificationEmail]
                .pendingChannels;
        if (verificationEmailChannels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendVerificationEmail(
                    verificationEmailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Welcome notification processed', results };
    }

    async processWelcomeSocial(userId: string): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message: 'User not found, skipping welcome social notification',
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
            EnumNotificationKind.welcomeSocial,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.welcomeSocial]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWelcomeSocial(emailPayload);
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Welcome social notification processed', results };
    }

    async processVerifiedEmail(
        userId: string,
        data: INotificationVerifiedEmailPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message: 'User not found, skipping verified email notification',
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
            EnumNotificationKind.verifiedEmail,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.verifiedEmail]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise = this.notificationEmailQueue.sendVerifiedEmail(
                emailPayload,
                data
            );
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Verified email notification processed', results };
    }

    async processVerificationEmail(
        userId: string,
        data: INotificationVerificationEmailEncryptedPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message:
                    'User not found, skipping verification email notification',
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
            EnumNotificationKind.verificationEmail,
            {
                id: notificationId,
                userId: user.id,
                metadata: { username: user.username },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.verificationEmail]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendVerificationEmail(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Verification email notification processed',
            results,
        };
    }

    async processVerifiedMobileNumber(
        userId: string,
        data: INotificationVerifiedMobileNumberPayload
    ): Promise<IQueueResponse> {
        const user = await this.userDomain.getOneActive(userId);

        if (!user) {
            return {
                message:
                    'User not found, skipping verified mobile number notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        const censoredMobileNumber = this.helperStringService.censor(
            data.mobileNumber
        );

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.verifiedMobileNumber,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    mobileNumber: censoredMobileNumber,
                },
                createdBy: user.id,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.verifiedMobileNumber]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendVerifiedMobileNumber(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Mobile number verified notification processed',
            results,
        };
    }
}
