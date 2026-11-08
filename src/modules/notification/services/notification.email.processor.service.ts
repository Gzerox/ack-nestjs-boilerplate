import { EnumNotificationProcess } from '@modules/notification/enums/notification.enum';
import type {
    INotificationEmailBulkQueuePayload,
    INotificationEmailQueuePayload,
    INotificationEmailUnregisteredQueuePayload,
    INotificationForgotPasswordEncryptedPayload,
    INotificationNewDeviceLoginPayload,
    INotificationPublishTermPolicyPayload,
    INotificationTemporaryPasswordEncryptedPayload,
    INotificationVerificationEmailEncryptedPayload,
    INotificationVerifiedEmailPayload,
    INotificationVerifiedMobileNumberPayload,
    INotificationWelcomeByAdminEncryptedPayload,
    INotificationWorkspaceInviteEncryptedPayload,
    INotificationWorkspaceInviteUnregisteredEncryptedPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationEmailAccountDomain } from '@modules/notification/domains/notification.email.account.domain';
import { NotificationEmailSecurityDomain } from '@modules/notification/domains/notification.email.security.domain';
import { NotificationEmailTermPolicyDomain } from '@modules/notification/domains/notification.email.term-policy.domain';
import { NotificationEmailWorkspaceDomain } from '@modules/notification/domains/notification.email.workspace.domain';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

@Injectable()
export class NotificationEmailProcessorService {
    constructor(
        private readonly notificationEmailAccountDomain: NotificationEmailAccountDomain,
        private readonly notificationEmailSecurityDomain: NotificationEmailSecurityDomain,
        private readonly notificationEmailTermPolicyDomain: NotificationEmailTermPolicyDomain,
        private readonly notificationEmailWorkspaceDomain: NotificationEmailWorkspaceDomain
    ) {}

    private isLastAttempt(job: Job): boolean {
        const maxAttempts = job.opts.attempts ?? 1;

        return job.attemptsMade + 1 >= maxAttempts;
    }

    async processWelcome(
        job: Job<
            INotificationEmailQueuePayload,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processWelcome(
            job.data.send,
            isLastAttempt
        );
    }

    async processWelcomeSocial(
        job: Job<
            INotificationEmailQueuePayload,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processWelcomeSocial(
            job.data.send,
            isLastAttempt
        );
    }

    async processWelcomeByAdmin(
        job: Job<
            INotificationEmailQueuePayload<INotificationWelcomeByAdminEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processWelcomeByAdmin(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processTemporaryPasswordByAdmin(
        job: Job<
            INotificationEmailQueuePayload<INotificationTemporaryPasswordEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processTemporaryPasswordByAdmin(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processChangePassword(
        job: Job<
            INotificationEmailQueuePayload,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processChangePassword(
            job.data.send,
            isLastAttempt
        );
    }

    async processResetPassword(
        job: Job<
            INotificationEmailQueuePayload,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processResetPassword(
            job.data.send,
            isLastAttempt
        );
    }

    async processVerificationEmail(
        job: Job<
            INotificationEmailQueuePayload<INotificationVerificationEmailEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processVerificationEmail(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processVerifiedEmail(
        job: Job<
            INotificationEmailQueuePayload<INotificationVerifiedEmailPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processVerifiedEmail(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processForgotPassword(
        job: Job<
            INotificationEmailQueuePayload<INotificationForgotPasswordEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processForgotPassword(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processVerifiedMobileNumber(
        job: Job<
            INotificationEmailQueuePayload<INotificationVerifiedMobileNumberPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailAccountDomain.processVerifiedMobileNumber(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processResetTwoFactorByAdmin(
        job: Job<
            INotificationEmailQueuePayload,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processResetTwoFactorByAdmin(
            job.data.send,
            isLastAttempt
        );
    }

    async processNewDeviceLogin(
        job: Job<
            INotificationEmailQueuePayload<INotificationNewDeviceLoginPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailSecurityDomain.processNewDeviceLogin(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processPublishTermPolicy(
        job: Job<
            INotificationEmailBulkQueuePayload<INotificationPublishTermPolicyPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailTermPolicyDomain.processPublishTermPolicy(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processWorkspaceInvite(
        job: Job<
            INotificationEmailQueuePayload<INotificationWorkspaceInviteEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailWorkspaceDomain.processWorkspaceInvite(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processWorkspaceInviteUnregistered(
        job: Job<
            INotificationEmailUnregisteredQueuePayload<INotificationWorkspaceInviteUnregisteredEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        return this.notificationEmailWorkspaceDomain.processWorkspaceInviteUnregistered(
            job.data.send,
            job.data.data!
        );
    }

    async processWorkspaceJoinRequest(
        job: Job<
            INotificationEmailQueuePayload<INotificationWorkspaceJoinRequestEncryptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailWorkspaceDomain.processWorkspaceJoinRequest(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processWorkspaceJoinAccepted(
        job: Job<
            INotificationEmailQueuePayload<INotificationWorkspaceJoinAcceptedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailWorkspaceDomain.processWorkspaceJoinAccepted(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }

    async processWorkspaceJoinRejected(
        job: Job<
            INotificationEmailQueuePayload<INotificationWorkspaceJoinRejectedPayload>,
            IQueueResponse,
            EnumNotificationProcess
        >
    ): Promise<IQueueResponse> {
        const isLastAttempt = this.isLastAttempt(job);

        return this.notificationEmailWorkspaceDomain.processWorkspaceJoinRejected(
            job.data.send,
            job.data.data!,
            isLastAttempt
        );
    }
}
