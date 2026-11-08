import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { MessageService } from '@common/message/services/message.service';
import {
    EnumNotificationChannel,
    EnumWorkspaceJoinRejectReason,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import { NotificationEmailWorkspaceDomain } from '@modules/notification/domains/notification.email.workspace.domain';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type {
    INotificationContent,
    INotificationEmailSendPayload,
    INotificationWorkspaceInviteEncryptedPayload,
    INotificationWorkspaceJoinRequestEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationEmailWorkspaceDomain', () => {
    const awsSESService = mock<AwsSESService>();
    const configService = mock<ConfigService>();
    const helperDateService = mock<HelperDateService>();
    const messageService = mock<MessageService>();
    const helperEncryptionService = mock<HelperEncryptionService>();
    const notificationRepository = mock<NotificationRepository>();
    let domain: NotificationEmailWorkspaceDomain;

    const send: INotificationEmailSendPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        email: 'nadia@example.com',
        username: 'nadia',
    };
    const sendWithCcBcc: INotificationEmailSendPayload = {
        ...send,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
    };
    const content: INotificationContent = {
        title: 'title',
        body: 'body',
        failureTokens: [],
    };
    const sesOutput = { $metadata: {}, MessageId: 'message-1' };
    const throttlingError = Object.assign(new Error('Rate exceeded'), {
        name: 'Throttling',
    });
    const rejectedError = Object.assign(
        new Error('Email address is not verified'),
        { name: 'MessageRejected' }
    );
    const defaultTemplateData = {
        homeName: 'Home',
        supportEmail: 'support@example.com',
        homeUrl: 'https://home.example.com',
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values: Record<string, string> = {
                'email.noreply': 'noreply@example.com',
                'email.support': 'support@example.com',
                'home.name': 'Home',
                'home.url': 'https://home.example.com',
                'app.encryptionSecretKey': 'secret-key',
            };

            return values[key];
        });
        helperDateService.createFromIso.mockImplementation(
            (iso: string) => new Date(iso)
        );
        helperDateService.formatToRFC2822.mockImplementation((date: Date) =>
            date.toISOString()
        );
        notificationRepository.markProcessing.mockResolvedValue(content);
        awsSESService.isInitialized.mockReturnValue(true);
        awsSESService.send.mockResolvedValue(sesOutput);
        const module = await Test.createTestingModule({
            providers: [
                NotificationEmailWorkspaceDomain,
                NotificationDeliveryDomain,
                { provide: AwsSESService, useValue: awsSESService },
                { provide: ConfigService, useValue: configService },
                { provide: HelperDateService, useValue: helperDateService },
                { provide: MessageService, useValue: messageService },
                {
                    provide: HelperEncryptionService,
                    useValue: helperEncryptionService,
                },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
            ],
        }).compile();
        domain = module.get(NotificationEmailWorkspaceDomain);
    });

    it('persists a safe permanent code while retaining the provider error for diagnostics', async () => {
        awsSESService.send.mockRejectedValue(rejectedError);
        awsSESService.classifyError.mockReturnValue({
            code: 'MessageRejected',
            isRetryable: false,
            retryAfterInMs: null,
            cause: rejectedError,
        });
        await expect(
            domain.processWorkspaceJoinAccepted(
                send,
                { workspaceId: 'workspace-id', workspaceName: 'Acme' },
                false
            )
        ).rejects.toMatchObject({
            statusCode: EnumNotificationStatusCodeError.deliveryFailed,
            isRetryable: false,
            rawError: rejectedError,
            messageProperties: { cause: 'MessageRejected' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            send.userId,
            send.notificationId,
            EnumNotificationChannel.email,
            'MessageRejected',
            []
        );
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
    });

    describe('processWorkspaceInvite', () => {
        const encrypted: INotificationWorkspaceInviteEncryptedPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            inviterName: 'Nadia',
            workspaceMemberRole: EnumWorkspaceMemberRole.member,
            encryptedInviteAcceptLink: 'cipher-link',
            reference: 'ref-1',
            expiredAt: '2024-02-01T00:00:00.000Z',
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://invite.example.com'
            );

            const result = await domain.processWorkspaceInvite(
                sendWithCcBcc,
                encrypted,
                false
            );

            expect(notificationRepository.markProcessing).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email
            );
            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedInviteAcceptLink,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.workspaceInvite,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    workspaceName: encrypted.workspaceName,
                    inviterName: encrypted.inviterName,
                    workspaceMemberRole: encrypted.workspaceMemberRole,
                    inviteAcceptLink: 'https://invite.example.com',
                    reference: encrypted.reference,
                    expiredAt: encrypted.expiredAt,
                },
                cc: sendWithCcBcc.cc,
                bcc: sendWithCcBcc.bcc,
            });
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'Workspace invite email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceInvite(
                send,
                encrypted,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace invite email',
            });
            expect(
                helperEncryptionService.aes256Decrypt
            ).not.toHaveBeenCalled();
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('skips when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceInvite(
                send,
                encrypted,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'SES not initialized, skipping workspace invite email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            await expect(
                domain.processWorkspaceInvite(send, encrypted, false)
            ).rejects.toMatchObject({
                isRetryable: false,
                rawError: error,
                messageProperties: { cause: 'decryptFailed' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                'decryptFailed',
                []
            );
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('marks retry on a throttling error before the last attempt, with no cc or bcc present', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://invite.example.com'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processWorkspaceInvite(send, encrypted, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(awsSESService.send).toHaveBeenCalledWith(
                expect.not.objectContaining({ cc: expect.anything() })
            );
            expect(notificationRepository.markRetry).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                'Throttling',
                []
            );
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWorkspaceInviteUnregistered', () => {
        const encrypted: INotificationWorkspaceInviteEncryptedPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            inviterName: 'Nadia',
            workspaceMemberRole: EnumWorkspaceMemberRole.member,
            encryptedInviteAcceptLink: 'cipher-link',
            reference: 'ref-1',
            expiredAt: '2024-02-01T00:00:00.000Z',
        };

        it('decrypts the invite link with the reference as context and sends the email with no cc or bcc', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://invite.example.com'
            );

            const result = await domain.processWorkspaceInviteUnregistered(
                { email: 'invitee@example.com' },
                encrypted
            );

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedInviteAcceptLink,
                'secret-key',
                'notification.payload',
                encrypted.reference
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.workspaceInvite,
                recipients: ['invitee@example.com'],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    workspaceName: encrypted.workspaceName,
                    inviterName: encrypted.inviterName,
                    workspaceMemberRole: encrypted.workspaceMemberRole,
                    inviteAcceptLink: 'https://invite.example.com',
                    reference: encrypted.reference,
                    expiredAt: encrypted.expiredAt,
                },
            });
            expect(result).toMatchObject({
                message: 'Workspace invite (unregistered) email processed',
            });
        });

        it('workspaceInviteUnregistered writes no delivery row', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://invite.example.com'
            );
            awsSESService.send.mockRejectedValue(throttlingError);

            await expect(
                domain.processWorkspaceInviteUnregistered(
                    { email: 'invitee@example.com' },
                    encrypted
                )
            ).rejects.toBe(throttlingError);
            expect(
                notificationRepository.markProcessing
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markRetry).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWorkspaceJoinRequest', () => {
        const encrypted: INotificationWorkspaceJoinRequestEncryptedPayload = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            requesterName: 'Omar',
            encryptedJoinRequestReviewLink: 'cipher-review-link',
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://review.example.com'
            );

            const result = await domain.processWorkspaceJoinRequest(
                sendWithCcBcc,
                encrypted,
                false
            );

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedJoinRequestReviewLink,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.workspaceJoinRequest,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    workspaceName: encrypted.workspaceName,
                    requesterName: encrypted.requesterName,
                    joinRequestReviewLink: 'https://review.example.com',
                },
                cc: sendWithCcBcc.cc,
                bcc: sendWithCcBcc.bcc,
            });
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'Workspace join request email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                encrypted,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join request email',
            });
            expect(
                helperEncryptionService.aes256Decrypt
            ).not.toHaveBeenCalled();
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('skips when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinRequest(
                send,
                encrypted,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping workspace join request email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            await expect(
                domain.processWorkspaceJoinRequest(send, encrypted, false)
            ).rejects.toMatchObject({
                isRetryable: false,
                rawError: error,
                messageProperties: { cause: 'decryptFailed' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                'decryptFailed',
                []
            );
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://review.example.com'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processWorkspaceJoinRequest(send, encrypted, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWorkspaceJoinAccepted', () => {
        const data = { workspaceId: 'workspace-id', workspaceName: 'Acme' };

        it('marks sent after SES accepts', async () => {
            const result = await domain.processWorkspaceJoinAccepted(
                sendWithCcBcc,
                data,
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.workspaceJoinAccepted,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    workspaceName: data.workspaceName,
                },
                cc: sendWithCcBcc.cc,
                bcc: sendWithCcBcc.bcc,
            });
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'Workspace join accepted email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join accepted email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('skips when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinAccepted(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping workspace join accepted email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processWorkspaceJoinAccepted(send, data, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWorkspaceJoinRejected', () => {
        const data = {
            workspaceId: 'workspace-id',
            workspaceName: 'Acme',
            rejectReasonCode: EnumWorkspaceJoinRejectReason.memberLimitReached,
        };

        it('marks sent after SES accepts', async () => {
            messageService.setMessage.mockReturnValue('Workspace is full');

            const result = await domain.processWorkspaceJoinRejected(
                sendWithCcBcc,
                data,
                false
            );

            expect(messageService.setMessage).toHaveBeenCalledWith(
                `notification.rejectReason.${data.rejectReasonCode}`
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.workspaceJoinRejected,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    workspaceName: data.workspaceName,
                    rejectReasonLabel: 'Workspace is full',
                },
                cc: sendWithCcBcc.cc,
                bcc: sendWithCcBcc.bcc,
            });
            expect(notificationRepository.markSent).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message: 'Workspace join rejected email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.markProcessing.mockResolvedValue(null);

            const result = await domain.processWorkspaceJoinRejected(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping workspace join rejected email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('skips when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processWorkspaceJoinRejected(
                send,
                data,
                false
            );

            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping workspace join rejected email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            messageService.setMessage.mockReturnValue('Workspace is full');
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processWorkspaceJoinRejected(send, data, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });
});
