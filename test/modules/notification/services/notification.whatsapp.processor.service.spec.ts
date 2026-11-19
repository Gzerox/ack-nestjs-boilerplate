import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { NotificationWhatsappAccountDomain } from '@modules/notification/domains/notification.whatsapp.account.domain';
import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';
import type { INotificationSendWhatsappVerificationPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationWhatsappProcessorService } from '@modules/notification/services/notification.whatsapp.processor.service';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationWhatsappProcessorService', () => {
    const accountDomain = mock<NotificationWhatsappAccountDomain>();
    let service: NotificationWhatsappProcessorService;
    const summary: IQueueResponse = { message: 'WhatsApp processed' };
    const payload: INotificationSendWhatsappVerificationPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        phoneNumber: '+628123456789',
        encryptedOtp: 'cipher',
        expiredInMinutes: 5,
        languageCode: 'id',
    };
    const job = {
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: payload,
    } as Job<
        INotificationSendWhatsappVerificationPayload,
        IQueueResponse,
        EnumNotificationWhatsappProcess
    >;

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationWhatsappProcessorService,
                {
                    provide: NotificationWhatsappAccountDomain,
                    useValue: accountDomain,
                },
            ],
        }).compile();
        service = module.get(NotificationWhatsappProcessorService);
    });

    it('forwards the payload to the account domain and returns its summary', async () => {
        accountDomain.processVerificationMobileNumber.mockResolvedValue(
            summary
        );

        const result = await service.processVerificationMobileNumber(job);

        expect(
            accountDomain.processVerificationMobileNumber
        ).toHaveBeenCalledWith(payload);
        expect(result).toEqual(summary);
    });

    it('propagates a domain failure so BullMQ retries the job', async () => {
        const error = new Error('delivery failed');
        accountDomain.processVerificationMobileNumber.mockRejectedValue(error);

        await expect(service.processVerificationMobileNumber(job)).rejects.toBe(
            error
        );
    });
});
