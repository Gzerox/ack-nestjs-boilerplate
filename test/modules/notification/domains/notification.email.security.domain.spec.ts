import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import type { IRequestLog } from '@common/request/interfaces/request.interface';
import {
    EnumNotificationChannel,
    EnumUserLoginFrom,
    EnumUserLoginWith,
} from '@generated/prisma-client/client';
import { flatten } from 'flat';
import { NotificationEmailSecurityDomain } from '@modules/notification/domains/notification.email.security.domain';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import type {
    INotificationContent,
    INotificationEmailSendPayload,
    INotificationNewDeviceLoginPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';

describe('NotificationEmailSecurityDomain', () => {
    const awsSESService = mock<AwsSESService>();
    const configService = mock<ConfigService>();
    const helperDateService = mock<HelperDateService>();
    const helperEncryptionService = mock<HelperEncryptionService>();
    const notificationRepository = mock<NotificationRepository>();
    let domain: NotificationEmailSecurityDomain;

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
        notificationRepository.findForDelivery.mockResolvedValue(content);
        awsSESService.isInitialized.mockReturnValue(true);
        awsSESService.send.mockResolvedValue(sesOutput);
        const module = await Test.createTestingModule({
            providers: [
                NotificationEmailSecurityDomain,
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
        domain = module.get(NotificationEmailSecurityDomain);
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
            domain.processResetPassword(send, false)
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

    describe('processTemporaryPasswordByAdmin', () => {
        const encrypted = {
            encryptedPassword: 'cipher-password',
            passwordExpiredAt: '2024-02-01T00:00:00.000Z',
            passwordCreatedAt: '2024-01-01T00:00:00.000Z',
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'plain-password'
            );

            const result = await domain.processTemporaryPasswordByAdmin(
                sendWithCcBcc,
                encrypted,
                false
            );

            expect(notificationRepository.findForDelivery).toHaveBeenCalledWith(
                send.userId,
                send.notificationId,
                EnumNotificationChannel.email
            );
            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedPassword,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.temporaryPasswordByAdmin,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
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
                message: 'Temporary password email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processTemporaryPasswordByAdmin(
                send,
                encrypted,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping temporary password email',
            });
            expect(
                helperEncryptionService.aes256Decrypt
            ).not.toHaveBeenCalled();
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processTemporaryPasswordByAdmin(
                send,
                encrypted,
                false
            );

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping temporary password email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            await expect(
                domain.processTemporaryPasswordByAdmin(send, encrypted, false)
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
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });

        it('marks retry on a throttling error before the last attempt, with no cc or bcc present', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'plain-password'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processTemporaryPasswordByAdmin(send, encrypted, false)
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

    describe('processChangePassword', () => {
        it('marks sent after SES accepts', async () => {
            const result = await domain.processChangePassword(
                sendWithCcBcc,
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.changePassword,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
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
                message: 'Change password email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processChangePassword(send, false);

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping change password email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processChangePassword(send, false);

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping change password email',
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
                domain.processChangePassword(send, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processResetPassword', () => {
        it('marks sent after SES accepts', async () => {
            const result = await domain.processResetPassword(
                sendWithCcBcc,
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.resetPassword,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
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
                message: 'Reset password email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processResetPassword(send, false);

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping reset password email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processResetPassword(send, false);

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping reset password email',
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
                domain.processResetPassword(send, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processForgotPassword', () => {
        const encrypted = {
            expiredAt: '2024-02-01T00:00:00.000Z',
            encryptedLink: 'cipher-link',
            reference: 'ref-1',
            expiredInMinutes: 15,
            resendInMinutes: 5,
        };

        it('marks sent after SES accepts', async () => {
            helperEncryptionService.aes256Decrypt.mockReturnValue(
                'https://reset.example.com'
            );

            const result = await domain.processForgotPassword(
                sendWithCcBcc,
                encrypted,
                false
            );

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                encrypted.encryptedLink,
                'secret-key',
                'notification.payload',
                sendWithCcBcc.userId
            );
            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.forgotPassword,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
                    username: sendWithCcBcc.username,
                    link: 'https://reset.example.com',
                    expiredAt: encrypted.expiredAt,
                    reference: encrypted.reference,
                    expiredInMinutes: '15',
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
                message: 'Forgot password email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processForgotPassword(
                send,
                encrypted,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping forgot password email',
            });
            expect(
                helperEncryptionService.aes256Decrypt
            ).not.toHaveBeenCalled();
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processForgotPassword(
                send,
                encrypted,
                false
            );

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping forgot password email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('marks failed when a sealed field fails to decrypt', async () => {
            const error = new HelperDecryptFailedException();
            helperEncryptionService.aes256Decrypt.mockImplementation(() => {
                throw error;
            });

            await expect(
                domain.processForgotPassword(send, encrypted, false)
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
                'https://reset.example.com'
            );
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processForgotPassword(send, encrypted, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processResetTwoFactorByAdmin', () => {
        it('marks sent after SES accepts', async () => {
            const result = await domain.processResetTwoFactorByAdmin(
                sendWithCcBcc,
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.resetTwoFactorByAdmin,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
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
                message: 'Reset two factor by admin email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processResetTwoFactorByAdmin(
                send,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping reset two factor by admin email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processResetTwoFactorByAdmin(
                send,
                false
            );

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message:
                    'SES not initialized, skipping reset two factor by admin email',
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
                domain.processResetTwoFactorByAdmin(send, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });

    describe('processNewDeviceLogin', () => {
        const requestLog: IRequestLog = {
            userAgent: {
                ua: 'Mozilla/5.0',
                browser: {
                    name: 'Chrome',
                    version: '120',
                    major: '120',
                    type: null,
                },
                cpu: { architecture: 'amd64' },
                device: { type: 'desktop', vendor: null, model: null },
                engine: { name: 'Blink', version: '120' },
                os: { name: 'macOS', version: '14' },
            },
            ipAddress: '203.0.113.5',
            geoLocation: {
                latitude: 37.7749,
                longitude: -122.4194,
                country: 'US',
                region: 'CA',
                city: 'San Francisco',
            },
        };
        const data: INotificationNewDeviceLoginPayload = {
            loginFrom: EnumUserLoginFrom.website,
            loginWith: EnumUserLoginWith.credential,
            loginAt: '2024-01-01T00:00:00.000Z',
            requestLog,
        };

        it('marks sent after SES accepts', async () => {
            const result = await domain.processNewDeviceLogin(
                sendWithCcBcc,
                data,
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith({
                templateName: EnumNotificationProcess.newDeviceLogin,
                recipients: [sendWithCcBcc.email],
                sender: 'noreply@example.com',
                templateData: {
                    homeName: 'Home',
                    supportEmail: 'support@example.com',
                    homeUrl: 'https://home.example.com',
                    username: sendWithCcBcc.username,
                    loginFrom: data.loginFrom,
                    loginWith: data.loginWith,
                    loginAt: data.loginAt,
                    userAgent: flatten(requestLog.userAgent),
                    ipAddress: '203.0.113.5',
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
                message: 'New device login email processed',
                result: { acceptedCount: 1 },
            });
        });

        it('defaults ipAddress to an empty string when null', async () => {
            await domain.processNewDeviceLogin(
                send,
                {
                    ...data,
                    requestLog: { ...data.requestLog, ipAddress: null },
                },
                false
            );

            expect(awsSESService.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    templateData: expect.objectContaining({ ipAddress: '' }),
                })
            );
        });

        it('skips when the delivery is already sent', async () => {
            notificationRepository.findForDelivery.mockResolvedValue(null);

            const result = await domain.processNewDeviceLogin(
                send,
                data,
                false
            );

            expect(result).toEqual({
                message:
                    'Delivery already sent or missing, skipping new device login email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('does nothing when SES is not initialized', async () => {
            awsSESService.isInitialized.mockReturnValue(false);

            const result = await domain.processNewDeviceLogin(
                send,
                data,
                false
            );

            expect(
                notificationRepository.findForDelivery
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
            expect(result).toEqual({
                message: 'SES not initialized, skipping new device login email',
            });
            expect(awsSESService.send).not.toHaveBeenCalled();
        });

        it('hands an SES rejection to the failure handler', async () => {
            awsSESService.send.mockRejectedValue(throttlingError);
            awsSESService.classifyError.mockReturnValue({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: null,
                cause: throttlingError,
            });

            await expect(
                domain.processNewDeviceLogin(send, data, false)
            ).rejects.toMatchObject({
                isRetryable: true,
                rawError: throttlingError,
            });
            expect(notificationRepository.markRetry).toHaveBeenCalled();
            expect(notificationRepository.markSent).not.toHaveBeenCalled();
        });
    });
});
