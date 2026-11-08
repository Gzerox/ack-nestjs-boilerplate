import { BulkEmailStatus } from '@aws-sdk/client-ses';
import type { SendBulkTemplatedEmailCommandOutput } from '@aws-sdk/client-ses';
import { AwsSESService } from '@common/aws/services/aws.ses.service';
import {
    EnumNotificationChannel,
    EnumNotificationDeliveryStatus,
} from '@generated/prisma-client/client';
import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import type {
    INotificationEmailSendPayload,
    INotificationPublishTermPolicyPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueException } from '@queues/exceptions/queue.exception';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Renders and sends one chunk of the term-policy publication email and records each delivery. */
@Injectable()
export class NotificationEmailTermPolicyDomain {
    private readonly noreplyEmail: string;
    private readonly supportEmail: string;

    private readonly homeName: string;
    private readonly homeUrl: string;

    private readonly defaultTemplateData: Record<string, string>;

    constructor(
        private readonly awsSESService: AwsSESService,
        private readonly configService: ConfigService,
        private readonly notificationRepository: NotificationRepository
    ) {
        this.noreplyEmail = this.configService.get<string>('email.noreply')!;
        this.supportEmail = this.configService.get<string>('email.support')!;

        this.homeName = this.configService.get<string>('home.name')!;
        this.homeUrl = this.configService.get<string>('home.url')!;

        this.defaultTemplateData = {
            homeName: this.homeName,
            supportEmail: this.supportEmail,
            homeUrl: this.homeUrl,
        };
    }

    private async assertNoFailedDeliveries(
        recipients: INotificationEmailSendPayload[],
        failed = 0,
        cause: Error | null = null
    ): Promise<void> {
        const states = await this.notificationRepository.findDeliveryStates(
            recipients.map(({ userId, notificationId }) => ({
                userId,
                notificationId,
                channel: EnumNotificationChannel.email,
            }))
        );
        if (
            failed > 0 ||
            states.some(
                ({ status }) => status === EnumNotificationDeliveryStatus.failed
            )
        ) {
            throw new NotificationDeliveryFailedException({
                code: 'bulkDeliveryFailed',
                isRetryable: false,
                retryAfterInMs: null,
                cause,
            });
        }
    }

    async processPublishTermPolicy(
        send: INotificationEmailSendPayload[],
        { type, version }: INotificationPublishTermPolicyPayload,
        isLastAttempt: boolean
    ): Promise<IQueueResponse> {
        const isInitialized = this.awsSESService.isInitialized();
        if (!isInitialized) {
            await this.assertNoFailedDeliveries(send);

            return {
                message:
                    'SES not initialized, skipping publish term policy email',
            };
        }

        const contentPromises = send.map(({ userId, notificationId }) =>
            this.notificationRepository.findForDelivery(
                userId,
                notificationId,
                EnumNotificationChannel.email
            )
        );
        const contents = await Promise.all(contentPromises);
        const kept = send.filter((_, index) => contents[index] !== null);
        if (kept.length === 0) {
            await this.assertNoFailedDeliveries(send);
            return {
                message:
                    'Every delivery already sent or missing, skipping publish term policy email',
            };
        }

        let result: SendBulkTemplatedEmailCommandOutput;
        try {
            result = await this.awsSESService.sendBulk({
                templateName: EnumNotificationProcess.publishTermPolicy,
                recipients: kept.map(({ email, username }) => ({
                    recipient: email,
                    templateData: { username },
                })),
                sender: this.noreplyEmail,
                defaultTemplateData: {
                    ...this.defaultTemplateData,
                    type,
                    version: String(version),
                },
            });
        } catch (error: unknown) {
            const failure = this.awsSESService.classifyError(error);
            const retry = failure.isRetryable && !isLastAttempt;
            const writes = kept.map(({ userId, notificationId }) => {
                if (retry) {
                    const write = this.notificationRepository.markRetry(
                        userId,
                        notificationId,
                        EnumNotificationChannel.email,
                        failure.code,
                        []
                    );
                    return write;
                }
                const write = this.notificationRepository.markFailed(
                    userId,
                    notificationId,
                    EnumNotificationChannel.email,
                    failure.code,
                    []
                );
                return write;
            });
            await Promise.all(writes);
            if (retry) {
                throw new NotificationDeliveryFailedException(failure);
            }
            await this.assertNoFailedDeliveries(
                send,
                kept.length,
                failure.cause
            );
            throw new NotificationDeliveryFailedException(failure);
        }

        let sent = 0;
        let retried = 0;
        let failed = 0;
        const markPromises: Promise<void>[] = [];
        for (const [index, { userId, notificationId }] of kept.entries()) {
            const entry = result.Status?.[index];
            const status = entry?.Status ?? BulkEmailStatus.Failed;
            if (status === BulkEmailStatus.Success) {
                sent++;
                const sentPromise = this.notificationRepository.markSent(
                    userId,
                    notificationId,
                    EnumNotificationChannel.email,
                    []
                );
                markPromises.push(sentPromise);

                continue;
            }

            const reason = status;
            const isRetryable =
                this.awsSESService.isRetryableBulkStatus(status);
            if (isRetryable && !isLastAttempt) {
                retried++;
                const retryPromise = this.notificationRepository.markRetry(
                    userId,
                    notificationId,
                    EnumNotificationChannel.email,
                    reason,
                    []
                );
                markPromises.push(retryPromise);

                continue;
            }

            failed++;
            const failedPromise = this.notificationRepository.markFailed(
                userId,
                notificationId,
                EnumNotificationChannel.email,
                reason,
                []
            );
            markPromises.push(failedPromise);
        }
        await Promise.all(markPromises);

        if (retried > 0) {
            throw new QueueException(
                `${retried} publish term policy recipients need a retry`
            );
        }

        await this.assertNoFailedDeliveries(send, failed);

        return {
            message: 'Publish term policy email processed',
            sent,
            failed,
        };
    }
}
