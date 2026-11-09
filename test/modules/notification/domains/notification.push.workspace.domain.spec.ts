import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { MessageService } from '@common/message/services/message.service';
import {
    EnumWorkspaceJoinRejectReason,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import { NotificationPushWorkspaceDomain } from '@modules/notification/domains/notification.push.workspace.domain';
import { NotificationPushDeliveryDomain } from '@modules/notification/domains/notification.push.delivery.domain';
import type { INotificationDeliverySummary } from '@modules/notification/interfaces/notification.interface';

describe('NotificationPushWorkspaceDomain', () => {
    const notificationPushDeliveryDomain =
        mock<NotificationPushDeliveryDomain>();
    const messageService = mock<MessageService>();
    const send = {
        userId: 'user',
        notificationId: 'notification',
        username: 'name',
        notificationTokens: ['token'],
    };
    const completed: INotificationDeliverySummary = {
        acceptedCount: 1,
        failedCount: 0,
        invalidTargetCount: 0,
        errorCodes: [],
    };
    let domain: NotificationPushWorkspaceDomain;
    beforeEach(async () => {
        vi.resetAllMocks();
        notificationPushDeliveryDomain.send.mockResolvedValue(completed);
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushWorkspaceDomain,
                {
                    provide: NotificationPushDeliveryDomain,
                    useValue: notificationPushDeliveryDomain,
                },
                { provide: MessageService, useValue: messageService },
            ],
        }).compile();
        domain = module.get(NotificationPushWorkspaceDomain);
    });
    it('prepares invite display properties without sending links to the push renderer', async () => {
        const data = {
            workspaceId: 'workspace',
            workspaceName: 'Acme',
            inviterName: 'inviter',
            workspaceMemberRole: EnumWorkspaceMemberRole.member,
            reference: 'ref',
            expiredAt: '2026-11-08T12:00:00Z',
        };
        expect(await domain.processWorkspaceInvite(send, data)).toBe(completed);
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            workspaceName: 'Acme',
            inviterName: 'inviter',
        });
    });
    it('prepares join-request display properties', async () => {
        await domain.processWorkspaceJoinRequest(send, {
            workspaceId: 'workspace',
            workspaceName: 'Acme',
            requesterName: 'requester',
        });
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            workspaceName: 'Acme',
            requesterName: 'requester',
        });
    });
    it('prepares accepted-request display properties', async () => {
        await domain.processWorkspaceJoinAccepted(send, {
            workspaceId: 'workspace',
            workspaceName: 'Acme',
        });
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            workspaceName: 'Acme',
        });
    });
    it('localizes the rejection reason before preparing its display properties', async () => {
        messageService.setMessage.mockReturnValue('Not a fit');
        await domain.processWorkspaceJoinRejected(send, {
            workspaceId: 'workspace',
            workspaceName: 'Acme',
            rejectReasonCode: EnumWorkspaceJoinRejectReason.notAFit,
        });
        expect(messageService.setMessage).toHaveBeenCalledWith(
            'notification.rejectReason.notAFit'
        );
        expect(notificationPushDeliveryDomain.send).toHaveBeenCalledWith(send, {
            username: 'name',
            workspaceName: 'Acme',
            rejectReasonLabel: 'Not a fit',
        });
    });
});
