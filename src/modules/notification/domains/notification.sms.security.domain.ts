import { Injectable } from '@nestjs/common';
import { AwsSNSService } from '@common/aws/services/aws.sns.service';
import { MessageService } from '@common/message/services/message.service';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { NotificationDeliveryDomain } from '@modules/notification/domains/notification.delivery.domain';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import type {
    INotificationDeliveryAttempt,
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
    async process(
        {
            userId,
            notificationId,
            kind,
            phoneNumbers,
        }: INotificationSendSmsPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
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
            return { outcome: 'completed', summary };
        }
        const content = await this.notificationDeliveryDomain.begin(context);
        if (!content) {
            return { outcome: 'completed', summary };
        }
        const targets = [...new Set(phoneNumbers)];
        if (targets.length === 0) {
            return { outcome: 'completed', summary };
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
                    isRetryable: false,
                    retryAfterInMs: null,
                    cause: error instanceof Error ? error : null,
                },
                isLastAttempt,
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
        const retryTargets: string[] = [];
        for (const [index, result] of results.entries()) {
            if (result.status === 'fulfilled' && result.value.messageId) {
                summary.acceptedCount++;
                continue;
            }
            let failure: INotificationDeliveryFailure;
            if (result.status === 'rejected') {
                const classified = this.awsSNSService.classifyError(
                    result.reason
                );
                failure = classified;
            } else {
                failure = {
                    code: 'snsMessageIdMissing',
                    isRetryable: false,
                    retryAfterInMs: null,
                    cause: null,
                };
            }
            failures.push(failure);
            if (failure.isRetryable) {
                retryTargets.push(targets[index]);
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
            return { outcome: 'completed', summary };
        }
        const failure =
            failures.find(error => error.isRetryable) ?? failures[0];
        try {
            const failed = await this.notificationDeliveryDomain.fail(
                context,
                failure,
                isLastAttempt,
                []
            );
            return failed;
        } catch (error: unknown) {
            if (
                error instanceof NotificationDeliveryFailedException &&
                error.isRetryable &&
                !isLastAttempt
            ) {
                return { outcome: 'retry', summary, retryTargets, failure };
            }
            throw error;
        }
    }
}
