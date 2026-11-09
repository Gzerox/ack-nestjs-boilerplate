import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { Injectable } from '@nestjs/common';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import type {
    INotificationDeliverySummary,
    INotificationSendSmsPayload,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationSmsSecurityDomain {
    constructor(
        private readonly awsSNSService: AwsSNSService,
        private readonly messageService: MessageService
    ) {}

    async process({
        kind,
        phoneNumbers,
    }: INotificationSendSmsPayload): Promise<INotificationDeliverySummary> {
        const summary: INotificationDeliverySummary = {
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        };
        const initialized = this.awsSNSService.isInitialized();
        if (!initialized || phoneNumbers.length === 0) {
            return summary;
        }
        const body = this.messageService.setMessage(`notification.sms.${kind}`);
        const sends = [...new Set(phoneNumbers)].map(phoneNumber =>
            this.awsSNSService.send(phoneNumber, body)
        );
        try {
            const results = await Promise.all(sends);
            summary.acceptedCount = results.filter(
                result => result.messageId
            ).length;
        } catch (error: unknown) {
            throw new AppUnknownException(error);
        }
        return summary;
    }
}
