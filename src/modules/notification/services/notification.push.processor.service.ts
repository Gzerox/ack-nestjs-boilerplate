import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { EnumNotificationPushProcess } from '@modules/notification/enums/notification.enum';
import type {
    INotificationDeliveryAttempt,
    INotificationNewDeviceLoginPayload,
    INotificationPushCleanupTokenQueuePayload,
    INotificationPushQueuePayload,
    INotificationTemporaryPasswordPushPayload,
    INotificationWorkspaceInvitePushPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestPushPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationPushMaintenanceDomain } from '@modules/notification/domains/notification.push.maintenance.domain';
import { NotificationPushSecurityDomain } from '@modules/notification/domains/notification.push.security.domain';
import { NotificationPushWorkspaceDomain } from '@modules/notification/domains/notification.push.workspace.domain';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

@Injectable()
export class NotificationPushProcessorService implements OnModuleInit {
    constructor(
        private readonly notificationPushSecurityDomain: NotificationPushSecurityDomain,
        private readonly notificationPushWorkspaceDomain: NotificationPushWorkspaceDomain,
        private readonly notificationPushMaintenanceDomain: NotificationPushMaintenanceDomain,
        private readonly notificationPushQueue: NotificationPushQueue
    ) {}

    private isLastAttempt(job: Job): boolean {
        const maxAttempts = job.opts.attempts ?? 1;

        return job.attemptsMade + 1 >= maxAttempts;
    }

    private async finishAttempt<T>(
        job: Job<INotificationPushQueuePayload<T>>,
        attempt: INotificationDeliveryAttempt
    ): Promise<IQueueResponse> {
        if (attempt.outcome === 'retry') {
            await job.updateData({
                ...job.data,
                send: {
                    ...job.data.send,
                    notificationTokens: attempt.retryTargets,
                },
            });
            throw new NotificationDeliveryFailedException(attempt.failure);
        }
        return {
            message: 'Push delivery attempt completed',
            result: attempt.summary,
        };
    }

    async onModuleInit(): Promise<void> {
        await this.notificationPushQueue.sendCleanupStaleTokens();
    }

    async processNewDeviceLogin(
        job: Job<
            INotificationPushQueuePayload<INotificationNewDeviceLoginPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushSecurityDomain.processNewDeviceLogin(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processResetTwoFactorByAdmin(
        job: Job<
            INotificationPushQueuePayload,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushSecurityDomain.processResetTwoFactorByAdmin(
                send,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processTemporaryPasswordByAdmin(
        job: Job<
            INotificationPushQueuePayload<INotificationTemporaryPasswordPushPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushSecurityDomain.processTemporaryPasswordByAdmin(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processResetPassword(
        job: Job<
            INotificationPushQueuePayload,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushSecurityDomain.processResetPassword(
                send,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processWorkspaceInvite(
        job: Job<
            INotificationPushQueuePayload<INotificationWorkspaceInvitePushPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushWorkspaceDomain.processWorkspaceInvite(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processWorkspaceJoinRequest(
        job: Job<
            INotificationPushQueuePayload<INotificationWorkspaceJoinRequestPushPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushWorkspaceDomain.processWorkspaceJoinRequest(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processWorkspaceJoinAccepted(
        job: Job<
            INotificationPushQueuePayload<INotificationWorkspaceJoinAcceptedPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushWorkspaceDomain.processWorkspaceJoinAccepted(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processWorkspaceJoinRejected(
        job: Job<
            INotificationPushQueuePayload<INotificationWorkspaceJoinRejectedPayload>,
            IQueueResponse,
            EnumNotificationPushProcess
        >
    ): Promise<IQueueResponse> {
        const { send, data } = job.data;
        const isLastAttempt = this.isLastAttempt(job);

        const attempt =
            await this.notificationPushWorkspaceDomain.processWorkspaceJoinRejected(
                send,
                data!,
                isLastAttempt
            );
        const response = await this.finishAttempt(job, attempt);
        return response;
    }

    async processCleanupTokens({
        data: {
            data: { userId, failureTokens },
        },
    }: Job<
        INotificationPushCleanupTokenQueuePayload,
        IQueueResponse,
        EnumNotificationPushProcess
    >): Promise<IQueueResponse> {
        const response =
            await this.notificationPushMaintenanceDomain.processCleanupTokens(
                userId,
                failureTokens
            );
        return response;
    }

    async processCleanupStaleTokens(): Promise<IQueueResponse> {
        const response =
            await this.notificationPushMaintenanceDomain.processCleanupStaleTokens();
        return response;
    }
}
