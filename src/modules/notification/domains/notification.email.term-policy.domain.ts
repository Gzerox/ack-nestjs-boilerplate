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
        failed = 0
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
                cause: null,
            });
        }
    }

    async processPublishTermPolicy(
        send: INotificationEmailSendPayload[],
        { type, version }: INotificationPublishTermPolicyPayload
    ): Promise<IQueueResponse> {
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
            const writes = kept.map(({ userId, notificationId }) => {
                const write = this.notificationRepository.markFailed(
                    userId,
                    notificationId,
                    EnumNotificationChannel.email,
                    []
                );
                return write;
            });
            await Promise.all(writes);

            throw new NotificationDeliveryFailedException(failure);
        }

        if (!result.Status?.length) {
            return {
                message:
                    'SES not initialized, skipping publish term policy email',
            };
        }

        let sent = 0;
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

            failed++;
            const failedPromise = this.notificationRepository.markFailed(
                userId,
                notificationId,
                EnumNotificationChannel.email,
                []
            );
            markPromises.push(failedPromise);
        }
        await Promise.all(markPromises);

        await this.assertNoFailedDeliveries(send, failed);

        return {
            message: 'Publish term policy email processed',
            sent,
            failed,
        };
    }
}
