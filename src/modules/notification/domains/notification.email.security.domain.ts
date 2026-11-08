import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationPayloadEncryptionPurpose } from '@modules/notification/constants/notification.constant';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import type {
    INotificationDeliveryFailure,
    INotificationEmailSendPayload,
    INotificationForgotPasswordEncryptedPayload,
    INotificationNewDeviceLoginPayload,
    INotificationTemporaryPasswordEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { flatten } from 'flat';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and sends the password, two-factor and new-device login emails. */
@Injectable()
export class NotificationEmailSecurityDomain {
    private readonly noreplyEmail: string;
    private readonly supportEmail: string;

    private readonly homeName: string;
    private readonly homeUrl: string;

    private readonly defaultTemplateData: Record<string, string>;

    private readonly encryptionSecretKey: string;

    constructor(
        private readonly awsSESService: AwsSESService,
        private readonly configService: ConfigService,
        private readonly helperDateService: HelperDateService,
        private readonly helperEncryptionService: HelperEncryptionService,
        private readonly notificationRepository: NotificationRepository,
        private readonly notificationDeliveryDomain: NotificationDeliveryDomain
    ) {
        this.noreplyEmail = this.configService.get<string>('email.noreply')!;
        this.supportEmail = this.configService.get<string>('email.support')!;

        this.homeName = this.configService.get<string>('home.name')!;
        this.homeUrl = this.configService.get<string>('home.url')!;
        this.encryptionSecretKey = this.configService.get<string>(
            'app.encryptionSecretKey'
        )!;

        this.defaultTemplateData = {
            homeName: this.homeName,
            supportEmail: this.supportEmail,
            homeUrl: this.homeUrl,
        };
    }

    private async handleSendFailure(
        userId: string,
        notificationId: string,
        error: unknown,
        isLastAttempt: boolean
    ): Promise<never> {
        let failure: INotificationDeliveryFailure;
        if (error instanceof HelperDecryptFailedException) {
            failure = {
                code: 'decryptFailed',
                isRetryable: false,
                retryAfterInMs: null,
                cause: error,
            };
        } else {
            const classified = this.awsSESService.classifyError(error);
            failure = classified;
        }
        const failed = await this.notificationDeliveryDomain.fail(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            failure,
            isLastAttempt,
            []
        );
        return failed;
    }

    async processTemporaryPasswordByAdmin(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            encryptedPassword,
            passwordExpiredAt,
            passwordCreatedAt,
        }: INotificationTemporaryPasswordEncryptedPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping temporary password email'
                    : 'SES not initialized, skipping temporary password email',
            };
        }

        try {
            const password = this.helperEncryptionService.aes256Decrypt(
                encryptedPassword,
                this.encryptionSecretKey,
                NotificationPayloadEncryptionPurpose,
                userId
            );

            const passwordExpiredAtDate =
                this.helperDateService.createFromIso(passwordExpiredAt);
            const passwordExpiredAtFormatted =
                this.helperDateService.formatToRFC2822(passwordExpiredAtDate);
            const passwordCreatedAtDate =
                this.helperDateService.createFromIso(passwordCreatedAt);
            const passwordCreatedAtFormatted =
                this.helperDateService.formatToRFC2822(passwordCreatedAtDate);
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.temporaryPasswordByAdmin,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    password,
                    passwordExpiredAt: passwordExpiredAtFormatted,
                    passwordCreatedAt: passwordCreatedAtFormatted,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'Temporary password email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processChangePassword(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping change password email'
                    : 'SES not initialized, skipping change password email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.changePassword,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'Change password email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processResetPassword(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping reset password email'
                    : 'SES not initialized, skipping reset password email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.resetPassword,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'Reset password email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processForgotPassword(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            expiredAt,
            encryptedLink,
            reference,
            expiredInMinutes,
        }: INotificationForgotPasswordEncryptedPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping forgot password email'
                    : 'SES not initialized, skipping forgot password email',
            };
        }

        try {
            const link = this.helperEncryptionService.aes256Decrypt(
                encryptedLink,
                this.encryptionSecretKey,
                NotificationPayloadEncryptionPurpose,
                userId
            );

            const expiredAtDate =
                this.helperDateService.createFromIso(expiredAt);
            const expiredAtFormatted =
                this.helperDateService.formatToRFC2822(expiredAtDate);
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.forgotPassword,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    link,
                    expiredAt: expiredAtFormatted,
                    reference,
                    expiredInMinutes: String(expiredInMinutes),
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'Forgot password email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processResetTwoFactorByAdmin(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping reset two factor by admin email'
                    : 'SES not initialized, skipping reset two factor by admin email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.resetTwoFactorByAdmin,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'Reset two factor by admin email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processNewDeviceLogin(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            loginFrom,
            loginWith,
            loginAt,
            requestLog: { userAgent, ipAddress },
        }: INotificationNewDeviceLoginPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        const notification = await this.notificationDeliveryDomain.begin(
            { userId, notificationId, channel: EnumNotificationChannel.email },
            isInitialized
        );
        if (!notification) {
            return {
                message: isInitialized
                    ? 'Delivery already sent or missing, skipping new device login email'
                    : 'SES not initialized, skipping new device login email',
            };
        }

        try {
            const loginAtDate = this.helperDateService.createFromIso(loginAt);
            const loginAtFormatted =
                this.helperDateService.formatToRFC2822(loginAtDate);
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.newDeviceLogin,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    loginFrom,
                    loginWith,
                    loginAt: loginAtFormatted,
                    userAgent: flatten(userAgent),
                    ipAddress: ipAddress ?? '',
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
        } catch (error: unknown) {
            const failure = await this.handleSendFailure(
                userId,
                notificationId,
                error,
                isLastAttempt
            );

            return failure;
        }

        await this.notificationRepository.markSent(
            userId,
            notificationId,
            EnumNotificationChannel.email,
            []
        );

        return {
            message: 'New device login email processed',
            result: { acceptedCount: 1 },
        };
    }
}
