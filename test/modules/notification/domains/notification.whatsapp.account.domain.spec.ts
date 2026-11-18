import { AwsSocialMessagingService } from '@common/aws/services/aws.social-messaging.service';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationPayloadEncryptionPurpose } from '@modules/notification/constants/notification.constant';
import { NotificationWhatsappAccountDomain } from '@modules/notification/domains/notification.whatsapp.account.domain';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

describe('NotificationWhatsappAccountDomain', () => {
    const socialMessaging = mock<AwsSocialMessagingService>();
    const notificationRepository = mock<NotificationRepository>();
    const configService = mock<ConfigService>();
    const helperEncryptionService = mock<HelperEncryptionService>();
    const payload: INotificationSendWhatsappVerificationPayload = {
        userId: 'user',
        notificationId: 'id',
        phoneNumber: '+111',
        encryptedOtp: 'cipher',
        expiredInMinutes: 5,
        languageCode: 'id',
    };
    let domain: NotificationWhatsappAccountDomain;
    let calls: string[];

    beforeEach(async () => {
        vi.resetAllMocks();
        calls = [];
        vi.mocked(configService.get).mockImplementation((key: string) =>
            key === 'app.encryptionSecretKey' ? 'secret-key' : undefined
        );
        socialMessaging.isInitialized.mockReturnValue(true);
        socialMessaging.resolveLanguageCode.mockReturnValue('id_ID');
        socialMessaging.sendAuthenticationTemplate.mockImplementation(
            async () => {
                calls.push('send');
                return { messageId: 'accepted', $metadata: {} };
            }
        );
        helperEncryptionService.aes256Decrypt.mockReturnValue('123456');
        notificationRepository.updateProcessAt.mockImplementation(async () => {
            calls.push('process');
            return { title: 't', body: 'b' };
        });
        notificationRepository.updateSentAt.mockImplementation(async () => {
            calls.push('sent');
        });
        const module = await Test.createTestingModule({
            providers: [
                NotificationWhatsappAccountDomain,
                {
                    provide: AwsSocialMessagingService,
                    useValue: socialMessaging,
                },
                { provide: ConfigService, useValue: configService },
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
        domain = module.get(NotificationWhatsappAccountDomain);
    });

    describe('processVerificationMobileNumber', () => {
        it('skips when WhatsApp is not initialized', async () => {
            socialMessaging.isInitialized.mockReturnValue(false);

            const result =
                await domain.processVerificationMobileNumber(payload);

            expect(result).toEqual({
                message: 'WhatsApp notification skipped',
            });
            expect(
                notificationRepository.updateProcessAt
            ).not.toHaveBeenCalled();
            expect(
                socialMessaging.sendAuthenticationTemplate
            ).not.toHaveBeenCalled();
        });

        it('skips when the phone number is empty', async () => {
            const result = await domain.processVerificationMobileNumber({
                ...payload,
                phoneNumber: '',
            });

            expect(result).toEqual({
                message: 'WhatsApp notification skipped',
            });
            expect(
                notificationRepository.updateProcessAt
            ).not.toHaveBeenCalled();
            expect(
                socialMessaging.sendAuthenticationTemplate
            ).not.toHaveBeenCalled();
        });

        it('skips when the notification row is missing', async () => {
            notificationRepository.updateProcessAt.mockResolvedValue(null);

            const result =
                await domain.processVerificationMobileNumber(payload);

            expect(result).toEqual({
                message:
                    'Notification not found, skipping WhatsApp notification',
            });
            expect(
                socialMessaging.sendAuthenticationTemplate
            ).not.toHaveBeenCalled();
            expect(notificationRepository.updateSentAt).not.toHaveBeenCalled();
        });

        it('decrypts the otp and sends the authentication template in order', async () => {
            const result =
                await domain.processVerificationMobileNumber(payload);

            expect(helperEncryptionService.aes256Decrypt).toHaveBeenCalledWith(
                'cipher',
                'secret-key',
                NotificationPayloadEncryptionPurpose,
                'user'
            );
            expect(notificationRepository.updateProcessAt).toHaveBeenCalledWith(
                'user',
                'id',
                EnumNotificationChannel.whatsapp
            );
            expect(socialMessaging.resolveLanguageCode).toHaveBeenCalledWith(
                'id'
            );
            expect(
                socialMessaging.sendAuthenticationTemplate
            ).toHaveBeenCalledWith({
                phoneNumber: '+111',
                parameter: '123456',
                languageCode: 'id_ID',
            });
            expect(notificationRepository.updateSentAt).toHaveBeenCalledWith(
                'user',
                'id',
                EnumNotificationChannel.whatsapp,
                []
            );
            expect(calls).toEqual(['process', 'send', 'sent']);
            expect(result.message).toBe('WhatsApp verification processed');
            expect(JSON.stringify(result)).not.toContain('123456');
        });

        it('propagates provider failures without marking sent', async () => {
            const error = new Error('unavailable');
            socialMessaging.sendAuthenticationTemplate.mockRejectedValue(error);

            await expect(
                domain.processVerificationMobileNumber(payload)
            ).rejects.toBe(error);
            expect(notificationRepository.updateSentAt).not.toHaveBeenCalled();
        });
    });
});
