import { Injectable } from '@nestjs/common';
import { MessageService } from '@common/message/services/message.service';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import type {
    INotificationDeliveryAttempt,
    INotificationSendPushPayload,
    INotificationWorkspaceInvitePushPayload,
    INotificationWorkspaceJoinAcceptedPayload,
    INotificationWorkspaceJoinRejectedPayload,
    INotificationWorkspaceJoinRequestPushPayload,
} from '@modules/notification/interfaces/notification.interface';

@Injectable()
export class NotificationPushWorkspaceDomain {
    constructor(
        private readonly notificationPushDeliveryDomain: NotificationPushDeliveryDomain,
        private readonly messageService: MessageService
    ) {}
    async processWorkspaceInvite(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceInvitePushPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            {
                username: send.username,
                workspaceName: data.workspaceName,
                inviterName: data.inviterName,
            },
            isLastAttempt
        );
        return attempt;
    }
    async processWorkspaceJoinRequest(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRequestPushPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            {
                username: send.username,
                workspaceName: data.workspaceName,
                requesterName: data.requesterName,
            },
            isLastAttempt
        );
        return attempt;
    }
    async processWorkspaceJoinAccepted(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinAcceptedPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            { username: send.username, workspaceName: data.workspaceName },
            isLastAttempt
        );
        return attempt;
    }
    async processWorkspaceJoinRejected(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRejectedPayload,
        isLastAttempt: boolean
    ): Promise<INotificationDeliveryAttempt> {
        const rejectReasonLabel = this.messageService.setMessage(
            `notification.rejectReason.${data.rejectReasonCode}`
        );
        const attempt = await this.notificationPushDeliveryDomain.send(
            send,
            {
                username: send.username,
                workspaceName: data.workspaceName,
                rejectReasonLabel,
            },
            isLastAttempt
        );
        return attempt;
    }
}
