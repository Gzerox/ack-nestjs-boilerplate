import { EnumNotificationPushProcess } from '@modules/notification/enums/notification.enum';
import type {
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

        return this.notificationPushSecurityDomain.processNewDeviceLogin(
            send,
            data!,
            isLastAttempt
        );
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

        return this.notificationPushSecurityDomain.processResetTwoFactorByAdmin(
            send,
            isLastAttempt
        );
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

        return this.notificationPushSecurityDomain.processTemporaryPasswordByAdmin(
            send,
            data!,
            isLastAttempt
        );
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

        return this.notificationPushSecurityDomain.processResetPassword(
            send,
            isLastAttempt
        );
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

        return this.notificationPushWorkspaceDomain.processWorkspaceInvite(
            send,
            data!,
            isLastAttempt
        );
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

        return this.notificationPushWorkspaceDomain.processWorkspaceJoinRequest(
            send,
            data!,
            isLastAttempt
        );
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

        return this.notificationPushWorkspaceDomain.processWorkspaceJoinAccepted(
            send,
            data!,
            isLastAttempt
        );
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

        return this.notificationPushWorkspaceDomain.processWorkspaceJoinRejected(
            send,
            data!,
            isLastAttempt
        );
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
        return this.notificationPushMaintenanceDomain.processCleanupTokens(
            userId,
            failureTokens
        );
    }

    async processCleanupStaleTokens(): Promise<IQueueResponse> {
        return this.notificationPushMaintenanceDomain.processCleanupStaleTokens();
    }
}
