import { Test } from '@nestjs/testing';
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { HelperDecryptFailedException } from '@common/helper/exceptions/helper.decrypt-failed.exception';
import { SentryService } from '@common/sentry/services/sentry.service';
import { NotificationWhatsappProcessor } from '@modules/notification/processors/notification.whatsapp.processor';
import { NotificationWhatsappProcessorService } from '@modules/notification/services/notification.whatsapp.processor.service';
import { EnumNotificationWhatsappProcess } from '@modules/notification/enums/notification.enum';

describe('NotificationWhatsappProcessor', () => {
    const service = mock<NotificationWhatsappProcessorService>();
    const sentryService = mock<SentryService>();
    const job = mock<Job<unknown, null, EnumNotificationWhatsappProcess>>();
    let processor: NotificationWhatsappProcessor;

    beforeEach(async () => {
        vi.resetAllMocks();
        job.name = EnumNotificationWhatsappProcess.verificationMobileNumber;
        job.opts = { attempts: 3 };
        job.attemptsMade = 1;
        const module = await Test.createTestingModule({
            providers: [
                NotificationWhatsappProcessor,
                {
                    provide: NotificationWhatsappProcessorService,
                    useValue: service,
                },
                { provide: SentryService, useValue: sentryService },
            ],
        }).compile();
        processor = module.get(NotificationWhatsappProcessor);
    });

    it('routes verificationMobileNumber to the service', async () => {
        service.processVerificationMobileNumber.mockResolvedValue({
            message: 'ok',
        });

        const result = await processor.process(job);

        expect(service.processVerificationMobileNumber).toHaveBeenCalledWith(
            job
        );
        expect(result).toEqual({ message: 'ok' });
    });

    it('rejects a decrypt failure as UnrecoverableError', async () => {
        const failure = new HelperDecryptFailedException();
        service.processVerificationMobileNumber.mockRejectedValue(failure);

        const call = processor.process(job);

        await expect(call).rejects.toBeInstanceOf(UnrecoverableError);
        await expect(call).rejects.toMatchObject({ message: failure.message });
    });

    it('rethrows any other error unchanged', async () => {
        const failure = new Error('provider');
        service.processVerificationMobileNumber.mockRejectedValue(failure);

        await expect(processor.process(job)).rejects.toBe(failure);
    });

    it('returns a message for an unknown job name', async () => {
        job.name = 'unknown' as EnumNotificationWhatsappProcess;

        const result = await processor.process(job);

        expect(result).toEqual({
            message:
                'No notification processor found for the given job name unknown',
        });
        expect(service.processVerificationMobileNumber).not.toHaveBeenCalled();
    });
});
