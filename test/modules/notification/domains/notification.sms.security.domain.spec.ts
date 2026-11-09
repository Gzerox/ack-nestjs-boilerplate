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
        phoneNumbers: ['+111', '+222'],
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
    it('sends once per unique number without a delivery record', async () => {
        await domain.process({ ...payload, phoneNumbers: ['+111', '+111'] });
        expect(sns.sendSms).toHaveBeenCalledTimes(1);
        expect(sns.sendSms).toHaveBeenCalledWith({
            phoneNumber: '+111',
            message: 'Security alert',
        });
    });
    it('propagates provider failures so BullMQ can retry', async () => {
        sns.sendSms.mockRejectedValue(new Error('unavailable'));
        await expect(domain.process(payload)).rejects.toMatchObject({
            rawError: expect.objectContaining({ message: 'unavailable' }),
        });
    });
    it('skips when SNS is disabled or no numbers are provided', async () => {
        sns.isInitialized.mockReturnValue(false);
        await domain.process(payload);
        sns.isInitialized.mockReturnValue(true);
        await domain.process({ ...payload, phoneNumbers: [] });
        expect(sns.sendSms).not.toHaveBeenCalled();
    });
});
