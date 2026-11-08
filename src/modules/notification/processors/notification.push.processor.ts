import type { OnApplicationBootstrap } from '@nestjs/common';
import { NotificationRetryUtil } from '@modules/notification/utils/notification.retry.util';
import {
    FirebaseMaxRateLimitPerDuration,
    FirebaseRateLimitDurationInMs,
} from '@common/firebase/constants/firebase.constant';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
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
import { NotificationPushProcessorService } from '@modules/notification/services/notification.push.processor.service';
import { Job, UnrecoverableError } from 'bullmq';
import { QueueProcessorBase } from '@queues/bases/queue.processor.base';
import { SentryService } from '@common/sentry/services/sentry.service';
import { QueueProcessor } from '@queues/decorators/queue.decorator';
import { EnumQueue } from '@queues/enums/queue.enum';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/**
 * Consumes the push queue (FCM); rate-limited to stay under Firebase send quota.
 */
@QueueProcessor(EnumQueue.notificationPush, {
    autorun: false,
    limiter: {
        max: FirebaseMaxRateLimitPerDuration,
        duration: FirebaseRateLimitDurationInMs,
    },
})
export class NotificationPushProcessor
    extends QueueProcessorBase
    implements OnApplicationBootstrap
{
    constructor(
        private readonly notificationPushProcessorService: NotificationPushProcessorService,
        private readonly notificationRetryUtil: NotificationRetryUtil,
        sentryService: SentryService
    ) {
        super(sentryService);
    }

    /** Dispatches each job to its handler by job name. */
    protected async handle(
        job: Job<unknown, IQueueResponse, EnumNotificationPushProcess>
    ): Promise<IQueueResponse> {
        try {
            switch (job.name) {
                case EnumNotificationPushProcess.newDeviceLogin:
                    return await this.notificationPushProcessorService.processNewDeviceLogin(
                        job as Job<
                            INotificationPushQueuePayload<INotificationNewDeviceLoginPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.resetTwoFactorByAdmin:
                    return await this.notificationPushProcessorService.processResetTwoFactorByAdmin(
                        job as Job<
                            INotificationPushQueuePayload,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.temporaryPasswordByAdmin:
                    return await this.notificationPushProcessorService.processTemporaryPasswordByAdmin(
                        job as Job<
                            INotificationPushQueuePayload<INotificationTemporaryPasswordPushPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.resetPassword:
                    return await this.notificationPushProcessorService.processResetPassword(
                        job as Job<
                            INotificationPushQueuePayload,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.workspaceInvite:
                    return await this.notificationPushProcessorService.processWorkspaceInvite(
                        job as Job<
                            INotificationPushQueuePayload<INotificationWorkspaceInvitePushPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.workspaceJoinRequest:
                    return await this.notificationPushProcessorService.processWorkspaceJoinRequest(
                        job as Job<
                            INotificationPushQueuePayload<INotificationWorkspaceJoinRequestPushPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.workspaceJoinAccepted:
                    return await this.notificationPushProcessorService.processWorkspaceJoinAccepted(
                        job as Job<
                            INotificationPushQueuePayload<INotificationWorkspaceJoinAcceptedPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.workspaceJoinRejected:
                    return await this.notificationPushProcessorService.processWorkspaceJoinRejected(
                        job as Job<
                            INotificationPushQueuePayload<INotificationWorkspaceJoinRejectedPayload>,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.cleanupTokens:
                    return await this.notificationPushProcessorService.processCleanupTokens(
                        job as Job<
                            INotificationPushCleanupTokenQueuePayload,
                            IQueueResponse,
                            EnumNotificationPushProcess
                        >
                    );
                case EnumNotificationPushProcess.cleanupStaleTokens:
                    return await this.notificationPushProcessorService.processCleanupStaleTokens();
                default:
                    return {
                        message: `No notification processor found for the given job name ${job.name}`,
                    };
            }
        } catch (error: unknown) {
            if (
                error instanceof NotificationDeliveryFailedException &&
                !error.isRetryable
            ) {
                const failure = new UnrecoverableError(error.message);
                failure.cause = error;
                throw failure;
            }

            throw error;
        }
    }
    onApplicationBootstrap(): void {
        const worker = this.worker;
        worker.opts.settings = {
            ...worker.opts.settings,
            backoffStrategy: (attemptsMade, _type, error) => {
                const failure =
                    error instanceof NotificationDeliveryFailedException
                        ? error
                        : null;
                const delay = this.notificationRetryUtil.delay(
                    attemptsMade,
                    failure
                );
                return delay;
            },
        };
        void worker.run().catch(error => worker.emit('error', error));
    }
}
