import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import { NotificationSmsSecurityDomain } from '@modules/notification/domains/notification.sms.security.domain';
import { EnumNotificationSmsProcess } from '@modules/notification/enums/notification.enum';
import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

describe('NotificationSmsSecurityDomain', () => {
    const sns = mock<AwsSNSService>();
    const messages = mock<MessageService>();
    const payload = {
        userId: 'user',
        notificationId: 'id',
        kind: EnumNotificationSmsProcess.newDeviceLogin,
        phoneNumber: '+111',
    };
    let domain: NotificationSmsSecurityDomain;
    beforeEach(async () => {
        vi.resetAllMocks();
        sns.isInitialized.mockReturnValue(true);
        sns.sendSms.mockResolvedValue({ MessageId: 'accepted', $metadata: {} });
        messages.setMessage.mockReturnValue('Security alert');
        const module = await Test.createTestingModule({
            providers: [
                NotificationSmsSecurityDomain,
                { provide: AwsSNSService, useValue: sns },
                { provide: MessageService, useValue: messages },
            ],
        }).compile();
        domain = module.get(NotificationSmsSecurityDomain);
    });
    it('sends the alert to the specified number', async () => {
        await domain.process(payload);
        expect(sns.sendSms).toHaveBeenCalledTimes(1);
        expect(sns.sendSms).toHaveBeenCalledWith({
            phoneNumber: '+111',
            message: 'Security alert',
        });
    });
    it('propagates provider failures so BullMQ can retry', async () => {
        const error = new Error('unavailable');
        sns.sendSms.mockRejectedValue(error);
        await expect(domain.process(payload)).rejects.toBe(error);
    });
    it('skips when SNS is disabled or no number is provided', async () => {
        sns.isInitialized.mockReturnValue(false);
        await domain.process(payload);
        sns.isInitialized.mockReturnValue(true);
        await domain.process({ ...payload, phoneNumber: '' });
        expect(sns.sendSms).not.toHaveBeenCalled();
    });
});
