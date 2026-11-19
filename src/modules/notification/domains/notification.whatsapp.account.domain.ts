import { AwsSocialMessagingService } from '@common/aws/services/aws.social-messaging.service';
import { HelperEncryptionService } from '@common/helper/services/helper.encryption.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationPayloadEncryptionPurpose } from '@modules/notification/constants/notification.constant';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Decrypts and sends the account verification code through WhatsApp. */
@Injectable()
export class NotificationWhatsappAccountDomain {
    private readonly encryptionSecretKey: string;

    constructor(
        private readonly awsSocialMessagingService: AwsSocialMessagingService,
        private readonly configService: ConfigService,
        private readonly helperEncryptionService: HelperEncryptionService,
        private readonly notificationRepository: NotificationRepository
    ) {
        this.encryptionSecretKey = this.configService.get<string>(
            'app.encryptionSecretKey'
        )!;
    }

    /**
     * Sends the one-time code to the phone number; skips when WhatsApp is off or
     * the number is empty.
     */
    async processVerificationMobileNumber({
        userId,
        notificationId,
        phoneNumber,
        encryptedOtp,
        languageCode,
    }: INotificationSendWhatsappVerificationPayload): Promise<IQueueResponse> {
        const initialized = this.awsSocialMessagingService.isInitialized();
        if (!initialized || !phoneNumber) {
            return { message: 'WhatsApp notification skipped' };
        }

        // Sequential by design: the row must be marked processing before the send, and sent only after it succeeds.
        const notification = await this.notificationRepository.updateProcessAt(
            userId,
            notificationId,
            EnumNotificationChannel.whatsapp
        );
        if (!notification) {
            return {
                message:
                    'Notification not found, skipping WhatsApp notification',
            };
        }

        const otp = this.helperEncryptionService.aes256Decrypt(
            encryptedOtp,
            this.encryptionSecretKey,
            NotificationPayloadEncryptionPurpose,
            userId
        );
        const resolvedLanguageCode =
            this.awsSocialMessagingService.resolveLanguageCode(languageCode);
        await this.awsSocialMessagingService.sendAuthenticationTemplate({
            phoneNumber,
            parameter: otp,
            languageCode: resolvedLanguageCode,
        });

        await this.notificationRepository.updateSentAt(
            userId,
            notificationId,
            EnumNotificationChannel.whatsapp,
            []
        );

        return { message: 'WhatsApp verification processed' };
    }
}
