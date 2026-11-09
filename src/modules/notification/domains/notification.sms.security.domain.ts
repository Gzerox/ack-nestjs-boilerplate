import { Injectable } from '@nestjs/common';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import type {
    INotificationDeliveryFailure,
    INotificationDeliverySummary,
    INotificationSendSmsPayload,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationSmsSecurityDomain {
    constructor(
        private readonly awsSNSService: AwsSNSService,
        private readonly notificationDeliveryDomain: NotificationDeliveryDomain,
        private readonly notificationRepository: NotificationRepository,
        private readonly messageService: MessageService
    ) {}

    async process({
        userId,
        notificationId,
        kind,
        phoneNumbers,
    }: INotificationSendSmsPayload): Promise<INotificationDeliverySummary> {
        const context = {
            userId,
            notificationId,
            channel: EnumNotificationChannel.sms,
        };
        const summary: INotificationDeliverySummary = {
            acceptedCount: 0,
            failedCount: 0,
            invalidTargetCount: 0,
            errorCodes: [],
        };
        const providerReady = this.awsSNSService.isInitialized();
        if (!providerReady) {
            return summary;
        }
        const content = await this.notificationDeliveryDomain.begin(context);
        if (!content) {
            return summary;
        }
        const targets = [...new Set(phoneNumbers)];
        if (targets.length === 0) {
            return summary;
        }
        let body: string;
        try {
            const renderedBody = this.messageService.setMessage(
                `notification.sms.${kind}`
            );
            body = renderedBody;
        } catch (error: unknown) {
            const failed = await this.notificationDeliveryDomain.fail(
                context,
                {
                    code: 'renderFailed',
                    cause: error instanceof Error ? error : null,
                },
                []
            );
            return failed;
        }
        const sends = targets.map(phoneNumber => {
            const sent = this.awsSNSService.send(phoneNumber, body);
            return sent;
        });
        const results = await Promise.allSettled(sends);
        const failures: INotificationDeliveryFailure[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.messageId) {
                summary.acceptedCount++;
                continue;
            }
            if (result.status === 'rejected') {
                const failure = this.awsSNSService.classifyError(result.reason);
                failures.push(failure);
            } else {
                failures.push({ code: 'snsMessageIdMissing', cause: null });
            }
        }
        summary.failedCount = failures.length;
        summary.errorCodes = [...new Set(failures.map(({ code }) => code))];
        if (summary.acceptedCount > 0) {
            await this.notificationRepository.markSent(
                userId,
                notificationId,
                context.channel,
                []
            );
            return summary;
        }
        const failed = await this.notificationDeliveryDomain.fail(
            context,
            failures[0],
            []
        );
        return failed;
    }
}
