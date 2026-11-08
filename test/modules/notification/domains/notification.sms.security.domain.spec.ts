import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import {
    InvalidParameterException,
    ThrottledException,
} from '@aws-sdk/client-sns';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationSmsSecurityDomain } from '@modules/notification/domains/notification.sms.security.domain';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';

describe('NotificationSmsSecurityDomain', () => {
    const awsSNSService = mock<AwsSNSService>();
    const notificationRepository = mock<NotificationRepository>();
    const messageService = mock<MessageService>();
    const payload = {
        userId: 'user',
        notificationId: 'notification',
        kind: EnumNotificationSmsProcess.newDeviceLogin,
        phoneNumbers: ['+111', '+222', '+333'],
    };
    const permanent = new InvalidParameterException({
        message: 'private number +222',
        $metadata: {},
    });
    const transient = new ThrottledException({
        message: 'private number +333',
        $metadata: {},
    });
    let domain: NotificationSmsSecurityDomain;
    beforeEach(async () => {
        vi.resetAllMocks();
        notificationRepository.markProcessing.mockResolvedValue({
            title: 'title',
            body: 'body',
            failureTokens: [],
        });
        awsSNSService.isInitialized.mockReturnValue(true);
        awsSNSService.send.mockResolvedValue({ messageId: 'accepted' });
        awsSNSService.classifyError.mockImplementation(error =>
            error === transient
                ? {
                      code: 'ThrottledException',
                      isRetryable: true,
                      retryAfterInMs: null,
                      cause: transient,
                  }
                : {
                      code: 'InvalidParameterException',
                      isRetryable: false,
                      retryAfterInMs: null,
                      cause: permanent,
                  }
        );
        messageService.setMessage.mockReturnValue('Security alert');
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsSecurityDomain,
                NotificationDeliveryDomain,
                { provide: AwsSNSService, useValue: awsSNSService },
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                { provide: MessageService, useValue: messageService },
            ],
        }).compile();
        domain = module.get(NotificationSmsSecurityDomain);
    });
    it('completes after any acceptance and exposes only safe partial counts/codes', async () => {
        awsSNSService.send
            .mockResolvedValueOnce({ messageId: 'accepted' })
            .mockRejectedValueOnce(permanent)
            .mockRejectedValueOnce(transient);
        expect(await domain.process(payload, false)).toEqual({
            outcome: 'completed',
            summary: {
                acceptedCount: 1,
                failedCount: 2,
                invalidTargetCount: 0,
                errorCodes: ['InvalidParameterException', 'ThrottledException'],
            },
        });
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            []
        );
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
    });
    it('returns only transient numbers when none were accepted', async () => {
        awsSNSService.send
            .mockRejectedValueOnce(permanent)
            .mockRejectedValueOnce(transient);
        await expect(
            domain.process(
                { ...payload, phoneNumbers: ['+222', '+333'] },
                false
            )
        ).resolves.toMatchObject({
            outcome: 'retry',
            retryTargets: ['+333'],
            failure: { code: 'ThrottledException', cause: transient },
        });
        expect(notificationRepository.markRetry).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            'ThrottledException',
            []
        );
    });
    it('persists final transient failure and retains the original SDK cause', async () => {
        awsSNSService.send.mockRejectedValue(transient);
        await expect(domain.process(payload, true)).rejects.toMatchObject({
            isRetryable: true,
            rawError: transient,
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            'ThrottledException',
            []
        );
    });
    it('fails permanently when every number has a permanent rejection', async () => {
        awsSNSService.send.mockRejectedValue(permanent);
        await expect(domain.process(payload, false)).rejects.toMatchObject({
            isRetryable: false,
            rawError: permanent,
        });
        expect(notificationRepository.markRetry).not.toHaveBeenCalled();
    });
    it('does not claim acceptance for a fulfilled publish without a message ID', async () => {
        awsSNSService.send.mockResolvedValue({ messageId: null });
        await expect(domain.process(payload, false)).rejects.toMatchObject({
            isRetryable: false,
            messageProperties: { cause: 'snsMessageIdMissing' },
        });
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
    });
    it('deduplicates phone numbers before sending', async () => {
        await expect(
            domain.process(
                { ...payload, phoneNumbers: ['+111', '+111'] },
                false
            )
        ).resolves.toMatchObject({
            outcome: 'completed',
            summary: { acceptedCount: 1 },
        });
        expect(awsSNSService.send).toHaveBeenCalledTimes(1);
    });
    it('skips empty recipients', async () => {
        await expect(
            domain.process({ ...payload, phoneNumbers: [] }, false)
        ).resolves.toMatchObject({
            outcome: 'completed',
            summary: { acceptedCount: 0, failedCount: 0 },
        });
        expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            []
        );
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
    it('skips a disabled provider', async () => {
        awsSNSService.isInitialized.mockReturnValue(false);
        await domain.process(payload, false);
        expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            []
        );
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
    it('does not send after a terminal or missing claim', async () => {
        notificationRepository.markProcessing.mockResolvedValue(null);
        await domain.process(payload, false);
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
});
