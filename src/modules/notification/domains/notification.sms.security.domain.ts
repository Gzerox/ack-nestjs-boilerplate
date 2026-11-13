import { Injectable } from '@nestjs/common';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import type { INotificationSendSmsPayload } from '@modules/notification/interfaces/notification.interface';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

@Injectable()
export class NotificationSmsSecurityDomain {
    constructor(
        private readonly awsSNSService: AwsSNSService,
        private readonly messageService: MessageService
    ) {}

    async process({
        kind,
        phoneNumber,
    }: INotificationSendSmsPayload): Promise<IQueueResponse> {
        const initialized = this.awsSNSService.isInitialized();
        if (!initialized || !phoneNumber) {
            return { message: 'SMS notification skipped' };
        }
        const body = this.messageService.setMessage(`notification.sms.${kind}`);
        const result = await this.awsSNSService.sendSms({
            phoneNumber,
            message: body,
        });
        return { message: 'SMS notification processed', result };
    }
}
