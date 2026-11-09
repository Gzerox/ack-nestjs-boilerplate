import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationPayloadEncryptionPurpose } from '@modules/notification/constants/notification.constant';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import type {
    INotificationEmailSendPayload,
    INotificationEmailSendUnregisteredPayload,
    INotificationWorkspaceInviteEncryptedPayload,
    INotificationWorkspaceInviteUnregisteredEncryptedPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and sends the workspace invite and join-request emails. */
@Injectable()
export class NotificationEmailWorkspaceDomain {
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
        private readonly messageService: MessageService,
        private readonly helperEncryptionService: HelperEncryptionService,
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

    async processWorkspaceInvite(
        {
            email,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            workspaceName,
            inviterName,
            workspaceMemberRole,
            encryptedInviteAcceptLink,
            reference,
            expiredAt,
        }: INotificationWorkspaceInviteEncryptedPayload
    ): Promise<IQueueResponse> {
        let messageId: string | null;
        try {
            const inviteAcceptLink = this.helperEncryptionService.aes256Decrypt(
                encryptedInviteAcceptLink,
                this.encryptionSecretKey,
                NotificationPayloadEncryptionPurpose,
                userId
            );

            const expiredAtDate =
                this.helperDateService.createFromIso(expiredAt);
            const expiredAtFormatted =
                this.helperDateService.formatToRFC2822(expiredAtDate);
            const sent = await this.awsSESService.send({
                templateName: EnumNotificationProcess.workspaceInvite,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    workspaceName,
                    inviterName,
                    workspaceMemberRole,
                    inviteAcceptLink,
                    reference,
                    expiredAt: expiredAtFormatted,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
            messageId = sent.MessageId ?? null;
        } catch (error: unknown) {
            const failure = this.awsSESService.classifyError(error);
            const failed = await this.notificationDeliveryDomain.fail(
                {
                    userId,
                    notificationId,
                    channel: EnumNotificationChannel.email,
                },
                failure,
                []
            );

            return failed;
        }

        const isSent = await this.notificationDeliveryDomain.completeEmail(
            userId,
            notificationId,
            messageId
        );
        if (!isSent) {
            return {
                message: 'SES not initialized, skipping workspace invite email',
            };
        }

        return {
            message: 'Workspace invite email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processWorkspaceInviteUnregistered(
        { email }: INotificationEmailSendUnregisteredPayload,
        {
            workspaceName,
            inviterName,
            workspaceMemberRole,
            encryptedInviteAcceptLink,
            reference,
            expiredAt,
        }: INotificationWorkspaceInviteUnregisteredEncryptedPayload
    ): Promise<IQueueResponse> {
        try {
            const inviteAcceptLink = this.helperEncryptionService.aes256Decrypt(
                encryptedInviteAcceptLink,
                this.encryptionSecretKey,
                NotificationPayloadEncryptionPurpose,
                reference
            );

            const expiredAtDate =
                this.helperDateService.createFromIso(expiredAt);
            const expiredAtFormatted =
                this.helperDateService.formatToRFC2822(expiredAtDate);
            const result = await this.awsSESService.send({
                templateName: EnumNotificationProcess.workspaceInvite,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    workspaceName,
                    inviterName,
                    workspaceMemberRole,
                    inviteAcceptLink,
                    reference,
                    expiredAt: expiredAtFormatted,
                },
            });

            if (!result.MessageId) {
                return {
                    message:
                        'SES not initialized, skipping workspace invite email',
                };
            }

            return {
                message: 'Workspace invite (unregistered) email processed',
                result: { acceptedCount: 1 },
            };
        } catch (error: unknown) {
            if (error instanceof HelperDecryptFailedException) {
                throw error;
            }
            const failure = this.awsSESService.classifyError(error);
            throw new NotificationDeliveryFailedException(failure);
        }
    }

    async processWorkspaceJoinRequest(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            workspaceName,
            requesterName,
            encryptedJoinRequestReviewLink,
        }: INotificationWorkspaceJoinRequestEncryptedPayload
    ): Promise<IQueueResponse> {
        let messageId: string | null;
        try {
            const joinRequestReviewLink =
                this.helperEncryptionService.aes256Decrypt(
                    encryptedJoinRequestReviewLink,
                    this.encryptionSecretKey,
                    NotificationPayloadEncryptionPurpose,
                    userId
                );

            const sent = await this.awsSESService.send({
                templateName: EnumNotificationProcess.workspaceJoinRequest,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    workspaceName,
                    requesterName,
                    joinRequestReviewLink,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
            messageId = sent.MessageId ?? null;
        } catch (error: unknown) {
            const failure = this.awsSESService.classifyError(error);
            const failed = await this.notificationDeliveryDomain.fail(
                {
                    userId,
                    notificationId,
                    channel: EnumNotificationChannel.email,
                },
                failure,
                []
            );

            return failed;
        }

        const isSent = await this.notificationDeliveryDomain.completeEmail(
            userId,
            notificationId,
            messageId
        );
        if (!isSent) {
            return {
                message:
                    'SES not initialized, skipping workspace join request email',
            };
        }

        return {
            message: 'Workspace join request email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processWorkspaceJoinAccepted(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        { workspaceName }: INotificationWorkspaceJoinAcceptedPayload
    ): Promise<IQueueResponse> {
        let messageId: string | null;
        try {
            const sent = await this.awsSESService.send({
                templateName: EnumNotificationProcess.workspaceJoinAccepted,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    workspaceName,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
            messageId = sent.MessageId ?? null;
        } catch (error: unknown) {
            const failure = this.awsSESService.classifyError(error);
            const failed = await this.notificationDeliveryDomain.fail(
                {
                    userId,
                    notificationId,
                    channel: EnumNotificationChannel.email,
                },
                failure,
                []
            );

            return failed;
        }

        const isSent = await this.notificationDeliveryDomain.completeEmail(
            userId,
            notificationId,
            messageId
        );
        if (!isSent) {
            return {
                message:
                    'SES not initialized, skipping workspace join accepted email',
            };
        }

        return {
            message: 'Workspace join accepted email processed',
            result: { acceptedCount: 1 },
        };
    }

    async processWorkspaceJoinRejected(
        {
            email,
            username,
            cc,
            bcc,
            userId,
            notificationId,
        }: INotificationEmailSendPayload,
        {
            workspaceName,
            rejectReasonCode,
        }: INotificationWorkspaceJoinRejectedPayload
    ): Promise<IQueueResponse> {
        let messageId: string | null;
        try {
            const rejectReasonLabel = this.messageService.setMessage(
                `notification.rejectReason.${rejectReasonCode}`
            );

            const sent = await this.awsSESService.send({
                templateName: EnumNotificationProcess.workspaceJoinRejected,
                recipients: [email],
                sender: this.noreplyEmail,
                templateData: {
                    ...this.defaultTemplateData,
                    username,
                    workspaceName,
                    rejectReasonLabel,
                },
                ...(cc?.length && { cc }),
                ...(bcc?.length && { bcc }),
            });
            messageId = sent.MessageId ?? null;
        } catch (error: unknown) {
            const failure = this.awsSESService.classifyError(error);
            const failed = await this.notificationDeliveryDomain.fail(
                {
                    userId,
                    notificationId,
                    channel: EnumNotificationChannel.email,
                },
                failure,
                []
            );

            return failed;
        }

        const isSent = await this.notificationDeliveryDomain.completeEmail(
            userId,
            notificationId,
            messageId
        );
        if (!isSent) {
            return {
                message:
                    'SES not initialized, skipping workspace join rejected email',
            };
        }

        return {
            message: 'Workspace join rejected email processed',
            result: { acceptedCount: 1 },
        };
    }
}
