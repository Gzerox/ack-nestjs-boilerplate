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
        notificationRepository.findForDelivery.mockResolvedValue({
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
                      cause: transient,
                  }
                : {
                      code: 'InvalidParameterException',
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
        expect(await domain.process(payload)).toEqual({
            acceptedCount: 1,
            failedCount: 2,
            invalidTargetCount: 0,
            errorCodes: ['InvalidParameterException', 'ThrottledException'],
        });
        expect(notificationRepository.markSent).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            []
        );
    });
    it('marks failed and throws with the first failure when none were accepted', async () => {
        awsSNSService.send
            .mockRejectedValueOnce(transient)
            .mockRejectedValueOnce(permanent);
        await expect(
            domain.process({ ...payload, phoneNumbers: ['+333', '+222'] })
        ).rejects.toMatchObject({
            rawError: transient,
            messageProperties: { cause: 'ThrottledException' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalledWith(
            'user',
            'notification',
            EnumNotificationChannel.sms,
            []
        );
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
    });
    it('marks failed and throws when the provider rejects every number', async () => {
        awsSNSService.send.mockRejectedValue(permanent);
        await expect(domain.process(payload)).rejects.toMatchObject({
            rawError: permanent,
        });
    });
    it('does not claim acceptance for a fulfilled publish without a message ID', async () => {
        awsSNSService.send.mockResolvedValue({ messageId: null });
        await expect(domain.process(payload)).rejects.toMatchObject({
            messageProperties: { cause: 'snsMessageIdMissing' },
        });
        expect(notificationRepository.markSent).not.toHaveBeenCalled();
    });
    it('marks failed and throws on a local rendering error without sending', async () => {
        const error = new Error('render private detail');
        messageService.setMessage.mockReset().mockImplementation(() => {
            throw error;
        });
        await expect(domain.process(payload)).rejects.toMatchObject({
            rawError: error,
            messageProperties: { cause: 'renderFailed' },
        });
        expect(notificationRepository.markFailed).toHaveBeenCalled();
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
    it('deduplicates phone numbers before sending', async () => {
        await expect(
            domain.process({ ...payload, phoneNumbers: ['+111', '+111'] })
        ).resolves.toMatchObject({ acceptedCount: 1 });
        expect(awsSNSService.send).toHaveBeenCalledTimes(1);
    });
    it('returns completed without a write for empty recipients', async () => {
        await expect(
            domain.process({ ...payload, phoneNumbers: [] })
        ).resolves.toEqual({
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        });
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
    it('skips a disabled provider', async () => {
        awsSNSService.isInitialized.mockReturnValue(false);
        expect(await domain.process(payload)).toEqual({
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        });
        expect(notificationRepository.findForDelivery).not.toHaveBeenCalled();
        expect(notificationRepository.markSkipped).not.toHaveBeenCalled();
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
    it('does not send after a terminal or missing claim', async () => {
        notificationRepository.findForDelivery.mockResolvedValue(null);
        await domain.process(payload);
        expect(awsSNSService.send).not.toHaveBeenCalled();
    });
});
