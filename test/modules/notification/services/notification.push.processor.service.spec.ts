import type { INotificationDeliverySummary } from '@modules/notification/interfaces/notification.interface';
import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import type { IRequestLog } from '@common/request/interfaces/request.interface';
import {
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumWorkspaceJoinRejectReason,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import { NotificationPushMaintenanceDomain } from '@modules/notification/domains/notification.push.maintenance.domain';
import { NotificationPushSecurityDomain } from '@modules/notification/domains/notification.push.security.domain';
import { NotificationPushWorkspaceDomain } from '@modules/notification/domains/notification.push.workspace.domain';
import { EnumNotificationPushProcess } from '@modules/notification/enums/notification.enum';
import type {
    INotificationNewDeviceLoginPayload,
    INotificationPushCleanupTokenQueuePayload,
    INotificationPushQueuePayload,
    INotificationSendPushPayload,
    INotificationWorkspaceInvitePushPayload,
    INotificationWorkspaceJoinRejectedPayload,
} from '@modules/notification/interfaces/notification.interface';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { NotificationPushProcessorService } from '@modules/notification/services/notification.push.processor.service';
import type { IQueueResponse } from '@queues/interfaces/queue.interface';

describe('NotificationPushProcessorService', () => {
    const notificationPushSecurityDomain =
        mock<NotificationPushSecurityDomain>();
    const notificationPushWorkspaceDomain =
        mock<NotificationPushWorkspaceDomain>();
    const notificationPushMaintenanceDomain =
        mock<NotificationPushMaintenanceDomain>();
    const notificationPushQueue = mock<NotificationPushQueue>();
    let service: NotificationPushProcessorService;

    const completedSummary: INotificationDeliverySummary = {
        acceptedCount: 1,
        failedCount: 0,
        invalidTargetCount: 0,
        errorCodes: [],
    };
    const response: IQueueResponse = { message: 'processed' };
    const send: INotificationSendPushPayload = {
        userId: 'user-id',
        notificationId: 'notification-id',
        notificationTokens: ['token-1'],
        username: 'nadia',
    };

    const jobState = { attemptsMade: 0, opts: { attempts: 3 } };

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await Test.createTestingModule({
            providers: [
                NotificationPushProcessorService,
                {
                    provide: NotificationPushSecurityDomain,
                    useValue: notificationPushSecurityDomain,
                },
                {
                    provide: NotificationPushWorkspaceDomain,
                    useValue: notificationPushWorkspaceDomain,
                },
                {
                    provide: NotificationPushMaintenanceDomain,
                    useValue: notificationPushMaintenanceDomain,
                },
                {
                    provide: NotificationPushQueue,
                    useValue: notificationPushQueue,
                },
            ],
        }).compile();
        service = module.get(NotificationPushProcessorService);
    });

    it('returns the delivery summary of an accepted partial send', async () => {
        const job = {
            ...jobState,
            data: { send },
        } as Job<
            INotificationPushQueuePayload,
            IQueueResponse,
            EnumNotificationPushProcess
        >;
        const summary = {
            acceptedCount: 1,
            failedCount: 1,
            invalidTargetCount: 0,
            errorCodes: ['messaging/server-unavailable'],
        };
        notificationPushSecurityDomain.processResetPassword.mockResolvedValue(
            summary
        );
        expect(await service.processResetPassword(job)).toEqual({
            message: 'Push delivery completed',
            result: summary,
        });
    });

    it('propagates a domain failure so BullMQ retries the job', async () => {
        const job = {
            ...jobState,
            data: { send },
        } as Job<
            INotificationPushQueuePayload,
            IQueueResponse,
            EnumNotificationPushProcess
        >;
        const error = new Error('delivery failed');
        notificationPushSecurityDomain.processResetPassword.mockRejectedValue(
            error
        );
        await expect(service.processResetPassword(job)).rejects.toBe(error);
    });

    describe('onModuleInit', () => {
        it('schedules the recurring stale-token cleanup job', async () => {
            notificationPushQueue.sendCleanupStaleTokens.mockResolvedValue(
                undefined
            );

            await service.onModuleInit();

            expect(
                notificationPushQueue.sendCleanupStaleTokens
            ).toHaveBeenCalledWith();
        });
    });

    describe('processNewDeviceLogin', () => {
        it('forwards send and data to the security domain', async () => {
            const requestLog: IRequestLog = {
                userAgent: {
                    ua: null,
                    browser: null,
                    cpu: null,
                    device: null,
                    engine: null,
                    os: null,
                },
                ipAddress: null,
                geoLocation: null,
            };
            const data: INotificationNewDeviceLoginPayload = {
                loginFrom: EnumUserLoginFrom.website,
                loginWith: EnumUserLoginWith.credential,
                loginAt: '2024-01-01T00:00:00.000Z',
                requestLog,
            };
            notificationPushSecurityDomain.processNewDeviceLogin.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processNewDeviceLogin(job);

            expect(
                notificationPushSecurityDomain.processNewDeviceLogin
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processResetTwoFactorByAdmin', () => {
        it('forwards send to the security domain', async () => {
            notificationPushSecurityDomain.processResetTwoFactorByAdmin.mockResolvedValue(
                completedSummary
            );
            const job = { ...jobState, data: { send } } as Job<
                INotificationPushQueuePayload,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processResetTwoFactorByAdmin(job);

            expect(
                notificationPushSecurityDomain.processResetTwoFactorByAdmin
            ).toHaveBeenCalledWith(send);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processTemporaryPasswordByAdmin', () => {
        it('forwards send and data to the security domain', async () => {
            const data = {
                passwordExpiredAt: '2024-02-01T00:00:00.000Z',
                passwordCreatedAt: '2024-01-01T00:00:00.000Z',
            };
            notificationPushSecurityDomain.processTemporaryPasswordByAdmin.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processTemporaryPasswordByAdmin(job);

            expect(
                notificationPushSecurityDomain.processTemporaryPasswordByAdmin
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processResetPassword', () => {
        it('forwards send to the security domain', async () => {
            notificationPushSecurityDomain.processResetPassword.mockResolvedValue(
                completedSummary
            );
            const job = { ...jobState, data: { send } } as Job<
                INotificationPushQueuePayload,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processResetPassword(job);

            expect(
                notificationPushSecurityDomain.processResetPassword
            ).toHaveBeenCalledWith(send);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processWorkspaceInvite', () => {
        it('forwards send and data to the workspace domain', async () => {
            const data: INotificationWorkspaceInvitePushPayload = {
                workspaceId: 'workspace-id',
                workspaceName: 'Acme',
                inviterName: 'Omar',
                workspaceMemberRole: EnumWorkspaceMemberRole.member,
                reference: 'ref-1',
                expiredAt: '2024-02-01T00:00:00.000Z',
            };
            notificationPushWorkspaceDomain.processWorkspaceInvite.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processWorkspaceInvite(job);

            expect(
                notificationPushWorkspaceDomain.processWorkspaceInvite
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processWorkspaceJoinRequest', () => {
        it('forwards send and data to the workspace domain', async () => {
            const data = {
                workspaceId: 'workspace-id',
                workspaceName: 'Acme',
                requesterName: 'Omar',
            };
            notificationPushWorkspaceDomain.processWorkspaceJoinRequest.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processWorkspaceJoinRequest(job);

            expect(
                notificationPushWorkspaceDomain.processWorkspaceJoinRequest
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processWorkspaceJoinAccepted', () => {
        it('forwards send and data to the workspace domain', async () => {
            const data = { workspaceId: 'workspace-id', workspaceName: 'Acme' };
            notificationPushWorkspaceDomain.processWorkspaceJoinAccepted.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processWorkspaceJoinAccepted(job);

            expect(
                notificationPushWorkspaceDomain.processWorkspaceJoinAccepted
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processWorkspaceJoinRejected', () => {
        it('forwards send and data to the workspace domain', async () => {
            const data: INotificationWorkspaceJoinRejectedPayload = {
                workspaceId: 'workspace-id',
                workspaceName: 'Acme',
                rejectReasonCode:
                    EnumWorkspaceJoinRejectReason.memberLimitReached,
            };
            notificationPushWorkspaceDomain.processWorkspaceJoinRejected.mockResolvedValue(
                completedSummary
            );
            const job = {
                ...jobState,
                data: {
                    send,
                    data,
                },
            } as Job<
                INotificationPushQueuePayload<typeof data>,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processWorkspaceJoinRejected(job);

            expect(
                notificationPushWorkspaceDomain.processWorkspaceJoinRejected
            ).toHaveBeenCalledWith(send, data);
            expect(result).toEqual({
                message: 'Push delivery completed',
                result: completedSummary,
            });
        });
    });

    describe('processCleanupTokens', () => {
        it('forwards userId and failureTokens to the maintenance domain', async () => {
            const payload: INotificationPushCleanupTokenQueuePayload = {
                data: { userId: 'user-id', failureTokens: ['token-1'] },
            };
            notificationPushMaintenanceDomain.processCleanupTokens.mockResolvedValue(
                response
            );
            const job = { ...jobState, data: payload } as Job<
                INotificationPushCleanupTokenQueuePayload,
                IQueueResponse,
                EnumNotificationPushProcess
            >;

            const result = await service.processCleanupTokens(job);

            expect(
                notificationPushMaintenanceDomain.processCleanupTokens
            ).toHaveBeenCalledWith('user-id', ['token-1']);
            expect(result).toBe(response);
        });
    });

    describe('processCleanupStaleTokens', () => {
        it('forwards to the maintenance domain', async () => {
            notificationPushMaintenanceDomain.processCleanupStaleTokens.mockResolvedValue(
                response
            );

            const result = await service.processCleanupStaleTokens();

            expect(
                notificationPushMaintenanceDomain.processCleanupStaleTokens
            ).toHaveBeenCalledWith();
            expect(result).toBe(response);
        });
    });
});
