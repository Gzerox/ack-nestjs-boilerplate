import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationSmsSecurityDomain } from '@modules/notification/domains/notification.sms.security.domain';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import type {
    INotificationDeliverySummary,
    INotificationSendSmsPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationSmsProcessorService } from '@modules/notification/services/notification.sms.processor.service';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';
import { mock } from 'vitest-mock-extended';

describe('NotificationSmsProcessorService', () => {
    const notificationSmsSecurityDomain = mock<NotificationSmsSecurityDomain>();
    let service: NotificationSmsProcessorService;

    const summary: INotificationDeliverySummary = {
        acceptedCount: 1,
        failedCount: 0,
        invalidTargetCount: 0,
        errorCodes: [],
    };

    const payload: INotificationSendSmsPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        kind: EnumNotificationSmsProcess.newDeviceLogin,
        phoneNumbers: ['+628123456789'],
    };

    const job = {
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: payload,
    } as Job<
        INotificationSendSmsPayload,
        IQueueResponse,
        EnumNotificationSmsProcess
    >;

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsProcessorService,
                {
                    provide: NotificationSmsSecurityDomain,
                    useValue: notificationSmsSecurityDomain,
                },
            ],
        }).compile();
        service = module.get(NotificationSmsProcessorService);
    });

    describe('processSecurityAlert', () => {
        it('routes the job payload to the sms security domain and returns its summary', async () => {
            notificationSmsSecurityDomain.process.mockResolvedValue(summary);

            const result = await service.processSecurityAlert(job);

            expect(notificationSmsSecurityDomain.process).toHaveBeenCalledWith(
                payload
            );
            expect(result).toEqual({
                message: 'SMS delivery completed',
                result: summary,
            });
        });

        it('propagates a domain failure so BullMQ retries the job', async () => {
            const error = new Error('delivery failed');
            notificationSmsSecurityDomain.process.mockRejectedValue(error);

            await expect(service.processSecurityAlert(job)).rejects.toBe(error);
        });
    });
});
