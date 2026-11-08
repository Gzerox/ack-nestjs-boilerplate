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
    INotificationVerificationEmailEncryptedPayload,
    INotificationVerifiedEmailPayload,
    INotificationVerifiedMobileNumberPayload,
    INotificationWelcomeByAdminEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and sends the sign-up, welcome and verification emails. */
@Injectable()
export class NotificationEmailAccountDomain {
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

    async processWelcome(
        {
            email,
            username,
            bcc,
            cc,
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
                    ? 'Delivery already sent or missing, skipping welcome email'
                    : 'SES not initialized, skipping welcome email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.welcome,
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
            message: 'Welcome email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processWelcomeSocial(
        {
            email,
            username,
            bcc,
            cc,
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
                    ? 'Delivery already sent or missing, skipping welcome social email'
                    : 'SES not initialized, skipping welcome social email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.welcomeSocial,
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
            message: 'Welcome social email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processWelcomeByAdmin(
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
        }: INotificationWelcomeByAdminEncryptedPayload,
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
                    ? 'Delivery already sent or missing, skipping create by admin email'
                    : 'SES not initialized, skipping create by admin email',
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
                templateName: EnumNotificationProcess.welcomeByAdmin,
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
            message: 'Create by admin email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processVerificationEmail(
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
            reference,
            encryptedLink,
            expiredInMinutes,
        }: INotificationVerificationEmailEncryptedPayload,
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
                    ? 'Delivery already sent or missing, skipping verification email'
                    : 'SES not initialized, skipping verification email',
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
            const expiredInMinutesFormatted = String(expiredInMinutes);

            await this.awsSESService.send({
                templateName: EnumNotificationProcess.verificationEmail,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    link,
                    reference,
                    expiredAt: expiredAtFormatted,
                    expiredInMinutes: expiredInMinutesFormatted,
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
            message: 'Verification email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processVerifiedEmail(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        { reference }: INotificationVerifiedEmailPayload,
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
                    ? 'Delivery already sent or missing, skipping email verified email'
                    : 'SES not initialized, skipping email verified email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.verifiedEmail,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    reference,
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
            message: 'Email verified email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processVerifiedMobileNumber(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        { reference, mobileNumber }: INotificationVerifiedMobileNumberPayload,
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
                    ? 'Delivery already sent or missing, skipping mobile number verified email'
                    : 'SES not initialized, skipping mobile number verified email',
            };
        }

        try {
            await this.awsSESService.send({
                templateName: EnumNotificationProcess.verifiedMobileNumber,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    reference,
                    mobileNumber,
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
            message: 'Mobile number verified email processed',
            result: { acceptedCount: 1 },
        };
    }
}
