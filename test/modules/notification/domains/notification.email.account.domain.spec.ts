import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { classifyAwsDeliveryError } from '@common/aws/utils/aws.delivery.util';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationEmailAccountDomain } from '@modules/notification/domains/notification.email.account.domain';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type { INotificationEmailSendPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationEmailAccountDomain', () => {
    const awsSESService = mock<AwsSESService>();
    const configService = mock<ConfigService>();
    const helperDateService = mock<HelperDateService>();
    const helperEncryptionService = mock<HelperEncryptionService>();
    const notificationRepository = mock<NotificationRepository>();
    let domain: NotificationEmailAccountDomain;

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
        awsSESService.send.mockResolvedValue(sesOutput);
        const module = await Test.createTestingModule({
            providers: [
                NotificationEmailAccountDomain,
                NotificationDeliveryDomain,
                { provide: AwsSESService, useValue: awsSESService },
                { provide: ConfigService, useValue: configService },
                { provide: HelperDateService, useValue: helperDateService },
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
        domain = module.get(NotificationEmailAccountDomain);
    });

    it('does not reclassify a failed markSent write as a provider rejection', async () => {
        const databaseError = new Error('write failed after acceptance');
        notificationRepository.markSent.mockRejectedValue(databaseError);
        await expect(domain.processWelcome(send)).rejects.toBe(databaseError);
        expect(awsSESService.send).toHaveBeenCalledTimes(1);
        expect(awsSESService.classifyError).not.toHaveBeenCalled();
        expect(notificationRepository.markFailed).not.toHaveBeenCalled();
    });

    it('persists a safe permanent code while retaining the provider error for diagnostics', async () => {
        awsSESService.send.mockRejectedValue(rejectedError);
        awsSESService.classifyError.mockReturnValue({
            code: 'MessageRejected',
            cause: rejectedError,
        });
        await expect(domain.processWelcome(send)).rejects.toMatchObject({
            statusCode: EnumNotificationStatusCodeError.deliveryFailed,
            rawError: rejectedError,
            messageProperties: { cause: 'MessageRejected' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            send.userId,
            send.notificationId,
            EnumNotificationChannel.email,
            []
        );
    });

    describe('processWelcome', () => {
        it('marks sent after SES accepts', async () => {
            const result = await domain.processWelcome(sendWithCcBcc);

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.welcome,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
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
                message: 'Welcome email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processWelcome(send);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping welcome email',
            });
        });

        it('marks failed on a throttling error, with no cc or bcc present', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(domain.processWelcome(send)).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(awsSESService.send).toHaveBeenCalledWith(
                expect.not.objectContaining({ cc: expect.anything() })
            );
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWelcomeSocial', () => {
        it('marks sent after SES accepts', async () => {
            const result = await domain.processWelcomeSocial(sendWithCcBcc);

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.welcomeSocial,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
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
                message: 'Welcome social email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processWelcomeSocial(send);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping welcome social email',
            });
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(
                domain.processWelcomeSocial(send)
            ).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processWelcomeByAdmin', () => {
        const encrypted = {
            encryptedPassword: 'cipher-password',
            passwordExpiredAt: '2024-02-01T00:00:00.000Z',
            passwordCreatedAt: '2024-01-01T00:00:00.000Z',
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'plain-password'
            );

            const result = await domain.processWelcomeByAdmin(
                sendWithCcBcc,
                encrypted
            );

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedPassword,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.welcomeByAdmin,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    password: 'plain-password',
                    passwordExpiredAt: encrypted.passwordExpiredAt,
                    passwordCreatedAt: encrypted.passwordCreatedAt,
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
                message: 'Create by admin email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processWelcomeByAdmin(send, encrypted);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping create by admin email',
            });
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            awsSESService.classifyError.mockImplementation(
                classifyAwsDeliveryError
            );

            await expect(
                domain.processWelcomeByAdmin(send, encrypted)
            ).rejects.toMatchObject({
                rawError: error,
                messageProperties: { cause: 'Error' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'plain-password'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(
                domain.processWelcomeByAdmin(send, encrypted)
            ).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processVerificationEmail', () => {
        const encrypted = {
            expiredAt: '2024-02-01T00:00:00.000Z',
            reference: 'ref-1',
            encryptedLink: 'cipher-link',
            expiredInMinutes: 30,
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://verify.example.com'
            );

            const result = await domain.processVerificationEmail(
                sendWithCcBcc,
                encrypted
            );

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedLink,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.verificationEmail,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    link: 'https://verify.example.com',
                    reference: encrypted.reference,
                    expiredAt: encrypted.expiredAt,
                    expiredInMinutes: '30',
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
                message: 'Verification email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processVerificationEmail(
                send,
                encrypted
            );

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping verification email',
            });
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            awsSESService.classifyError.mockImplementation(
                classifyAwsDeliveryError
            );

            await expect(
                domain.processVerificationEmail(send, encrypted)
            ).rejects.toMatchObject({
                rawError: error,
                messageProperties: { cause: 'Error' },
            });
            expect(notificationRepository.markFailed).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email,
                []
            );
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://verify.example.com'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(
                domain.processVerificationEmail(send, encrypted)
            ).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processVerifiedEmail', () => {
        const data = { reference: 'ref-1' };

        it('marks sent after SES accepts', async () => {
            const result = await domain.processVerifiedEmail(
                sendWithCcBcc,
                data
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.verifiedEmail,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    reference: data.reference,
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
                message: 'Email verified email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processVerifiedEmail(send, data);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping email verified email',
            });
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(
                domain.processVerifiedEmail(send, data)
            ).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processVerifiedMobileNumber', () => {
        const data = {
            reference: 'ref-1',
            mobileNumber: '+1555****567',
            resendInMinutes: 5,
        };

        it('marks sent after SES accepts', async () => {
            const result = await domain.processVerifiedMobileNumber(
                sendWithCcBcc,
                data
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.verifiedMobileNumber,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    ...defaultTemplateData,
                    username: sendWithCcBcc.username,
                    reference: data.reference,
                    mobileNumber: data.mobileNumber,
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
                message: 'Mobile number verified email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('leaves the delivery pending when SES returns no message id', async () => {
            awsSESService.send.mockResolvedValue({
                $metadata: {},
                MessageId: undefined,
            });

            const result = await domain.processVerifiedMobileNumber(send, data);

            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
            expect(notificationRepository.markFailed).not.toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping mobile number verified email',
            });
        });

        it('hands an SES rejection to the failure handler, with no cc or bcc present', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                cause: throttlingError,
            });

            await expect(
                domain.processVerifiedMobileNumber(send, data)
            ).rejects.toMatchObject({
                rawError: throttlingError,
            });
            expect(notificationRepository.markFailed).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });
});
