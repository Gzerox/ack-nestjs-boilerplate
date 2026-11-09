import { Injectable } from '@nestjs/common';
import { MessageService } from '@common/message/services/message.service';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import type {
    INotificationDeliverySummary,
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
        data: INotificationWorkspaceInvitePushPayload
    ): Promise<INotificationDeliverySummary> {
        const summary = await this.notificationPushDeliveryDomain.send(send, {
            username: send.username,
            workspaceName: data.workspaceName,
            inviterName: data.inviterName,
        });
        return summary;
    }
    async processWorkspaceJoinRequest(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRequestPushPayload
    ): Promise<INotificationDeliverySummary> {
        const summary = await this.notificationPushDeliveryDomain.send(send, {
            username: send.username,
            workspaceName: data.workspaceName,
            requesterName: data.requesterName,
        });
        return summary;
    }
    async processWorkspaceJoinAccepted(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinAcceptedPayload
    ): Promise<INotificationDeliverySummary> {
        const summary = await this.notificationPushDeliveryDomain.send(send, {
            username: send.username,
            workspaceName: data.workspaceName,
        });
        return summary;
    }
    async processWorkspaceJoinRejected(
        send: INotificationSendPushPayload,
        data: INotificationWorkspaceJoinRejectedPayload
    ): Promise<INotificationDeliverySummary> {
        const rejectReasonLabel = this.messageService.setMessage(
            `notification.rejectReason.${data.rejectReasonCode}`
        );
        const summary = await this.notificationPushDeliveryDomain.send(send, {
            username: send.username,
            workspaceName: data.workspaceName,
            rejectReasonLabel,
        });
        return summary;
    }
}
