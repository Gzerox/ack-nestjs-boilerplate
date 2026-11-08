import { DatabaseUtil } from '@common/database/utils/database.util';
import { EnumNotificationChannel } from '@generated/prisma-client/client';
import { DeviceDomain } from '@modules/device/domains/device.domain';
import { NotificationKindContract } from '@modules/notification/contracts/notification.kind.contract';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import type {
    INotificationEmailSendPayload,
    INotificationSendPushPayload,
    INotificationWorkspaceInviteEncryptedPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestEncryptedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationEmailQueue } from '@modules/notification/queues/notification.email.queue';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { UserDomain } from '@modules/user/domains/user.domain';
import { Injectable } from '@nestjs/common';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

/** Writes and fans out the workspace invite and join-request notifications. */
@Injectable()
export class NotificationWorkspaceDomain {
    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly userDomain: UserDomain,
        private readonly deviceDomain: DeviceDomain,
        private readonly databaseUtil: DatabaseUtil,
        private readonly notificationEmailQueue: NotificationEmailQueue,
        private readonly notificationPushQueue: NotificationPushQueue
    ) {}

    async processWorkspaceInvite(
        userId: string,
        proceedBy: string,
        data: INotificationWorkspaceInviteEncryptedPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping workspace invite notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.workspaceInvite,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    workspaceId: data.workspaceId,
                    workspaceName: data.workspaceName,
                    inviterName: data.inviterName,
                },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.workspaceInvite]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWorkspaceInvite(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendWorkspaceInvite(
                        pushPayload,
                        {
                            workspaceId: data.workspaceId,
                            workspaceName: data.workspaceName,
                            inviterName: data.inviterName,
                            workspaceMemberRole: data.workspaceMemberRole,
                            reference: data.reference,
                            expiredAt: data.expiredAt,
                        }
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return { message: 'Workspace invite notification processed', results };
    }

    async processWorkspaceJoinRequest(
        userId: string,
        proceedBy: string,
        data: INotificationWorkspaceJoinRequestEncryptedPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping workspace join request notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.workspaceJoinRequest,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    workspaceId: data.workspaceId,
                    workspaceName: data.workspaceName,
                    requesterName: data.requesterName,
                },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.workspaceJoinRequest]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWorkspaceJoinRequest(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendWorkspaceJoinRequest(
                        pushPayload,
                        {
                            workspaceId: data.workspaceId,
                            workspaceName: data.workspaceName,
                            requesterName: data.requesterName,
                        }
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Workspace join request notification processed',
            results,
        };
    }

    async processWorkspaceJoinAccepted(
        userId: string,
        proceedBy: string,
        data: INotificationWorkspaceJoinAcceptedPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping workspace join accepted notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.workspaceJoinAccepted,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    workspaceId: data.workspaceId,
                    workspaceName: data.workspaceName,
                },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.workspaceJoinAccepted]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWorkspaceJoinAccepted(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendWorkspaceJoinAccepted(
                        pushPayload,
                        data
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Workspace join accepted notification processed',
            results,
        };
    }

    async processWorkspaceJoinRejected(
        userId: string,
        proceedBy: string,
        data: INotificationWorkspaceJoinRejectedPayload
    ): Promise<IQueueResponse> {
        const userPromise = this.userDomain.getOneActive(userId);
        const devicesPromise =
            this.deviceDomain.getOwnershipsWithNotificationToken(userId);
        const [user, devices] = await Promise.all([
            userPromise,
            devicesPromise,
        ]);

        if (!user) {
            return {
                message:
                    'User not found, skipping workspace join rejected notification',
            };
        }

        const notificationId = this.databaseUtil.createId();
        const emailPayload: INotificationEmailSendPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            notificationId,
        };

        const notificationTokens = devices
            .map(d => d.device.notificationToken)
            .filter((t): t is string => t !== null);

        // Sequential by design: a channel job needs its delivery row to exist.
        await this.notificationRepository.create(
            EnumNotificationKind.workspaceJoinRejected,
            {
                id: notificationId,
                userId: user.id,
                metadata: {
                    username: user.username,
                    workspaceId: data.workspaceId,
                    workspaceName: data.workspaceName,
                    rejectReasonCode: data.rejectReasonCode,
                },
                createdBy: proceedBy,
            }
        );

        const promises: Promise<void>[] = [];
        const channels =
            NotificationKindContract[EnumNotificationKind.workspaceJoinRejected]
                .pendingChannels;
        if (channels.includes(EnumNotificationChannel.email)) {
            const emailPromise =
                this.notificationEmailQueue.sendWorkspaceJoinRejected(
                    emailPayload,
                    data
                );
            promises.push(emailPromise);
        }
        if (channels.includes(EnumNotificationChannel.push)) {
            if (notificationTokens.length > 0) {
                const pushPayload: INotificationSendPushPayload = {
                    userId,
                    notificationId,
                    notificationTokens,
                    username: user.username,
                };
                const pushPromise =
                    this.notificationPushQueue.sendWorkspaceJoinRejected(
                        pushPayload,
                        data
                    );
                promises.push(pushPromise);
            } else {
                const skipped = this.notificationRepository.markSkipped(
                    user.id,
                    notificationId,
                    EnumNotificationChannel.push,
                    []
                );
                promises.push(skipped);
            }
        }
        const outcomes = await Promise.allSettled(promises);
        const results = outcomes.map(({ status }) => ({ status }));

        return {
            message: 'Workspace join rejected notification processed',
            results,
        };
    }
}
