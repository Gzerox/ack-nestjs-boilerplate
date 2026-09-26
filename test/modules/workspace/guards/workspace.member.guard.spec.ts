import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { RequestStoreService } from '@common/request/services/request.store.service';
import {
    EnumPolicyAction,
    EnumPolicySubject,
    EnumRoleScope,
} from '@generated/prisma-client';
import { PolicyStoreKey } from '@modules/policy/constants/policy.constant';
import { EnumRoleWorkspaceKey } from '@modules/role/enums/role.workspace-key.enum';
import { UserStoreKey } from '@modules/user/constants/user.constant';
import {
    WorkspaceMemberStoreKey,
    WorkspaceStoreKey,
} from '@modules/workspace/constants/workspace.constant';
import { WorkspaceMemberDomain } from '@modules/workspace/domains/workspace.member.domain';
import { WorkspaceMemberGuard } from '@modules/workspace/guards/workspace.member.guard';
import type { IWorkspaceMemberWithRole } from '@modules/workspace/interfaces/workspace.interface';

describe('WorkspaceMemberGuard', () => {
    const workspaceMemberDomain: MockProxy<WorkspaceMemberDomain> =
        mock<WorkspaceMemberDomain>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const context: MockProxy<ExecutionContext> = mock<ExecutionContext>();
    const joinedAt = new Date('2026-01-01T00:00:00.000Z');
    const policies = [
        {
            id: 'policy-id',
            roleId: 'role-id',
            subject: EnumPolicySubject.workspace,
            action: [EnumPolicyAction.read],
            createdAt: joinedAt,
            createdBy: null,
            updatedAt: joinedAt,
            updatedBy: null,
        },
    ];
    const member: IWorkspaceMemberWithRole = {
        id: 'member-id',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        roleId: 'role-id',
        role: {
            id: 'role-id',
            scope: EnumRoleScope.workspace,
            key: EnumRoleWorkspaceKey.member,
            name: 'Member',
            description: null,
            createdAt: joinedAt,
            createdBy: null,
            updatedAt: joinedAt,
            updatedBy: null,
            policies,
        },
        joinedAt,
        createdAt: joinedAt,
        createdBy: null,
        updatedAt: joinedAt,
        updatedBy: null,
    };
    let guard: WorkspaceMemberGuard;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkspaceMemberGuard,
                {
                    provide: WorkspaceMemberDomain,
                    useValue: workspaceMemberDomain,
                },
                {
                    provide: RequestStoreService,
                    useValue: requestStoreService,
                },
            ],
        }).compile();

        guard = module.get(WorkspaceMemberGuard);
    });

    it('validates and stores the current membership', async () => {
        const workspace = { id: 'workspace-id' };
        const user = { id: 'user-id' };
        requestStoreService.get.mockImplementation((key: unknown) => {
            if (key === WorkspaceStoreKey) return workspace;
            if (key === UserStoreKey) return user;
            return undefined;
        });
        workspaceMemberDomain.validateWorkspaceMemberGuard.mockResolvedValue(
            member
        );

        await expect(guard.canActivate(context)).resolves.toBe(true);
        expect(
            workspaceMemberDomain.validateWorkspaceMemberGuard
        ).toHaveBeenCalledWith('workspace-id', 'user-id');
        expect(requestStoreService.set).toHaveBeenCalledWith(
            WorkspaceMemberStoreKey,
            member
        );
    });

    it('overwrites the policy store with the policies of the workspace role', async () => {
        requestStoreService.get.mockImplementation((key: unknown) => {
            if (key === WorkspaceStoreKey) return { id: 'workspace-id' };
            if (key === UserStoreKey) return { id: 'user-id' };
            return undefined;
        });
        workspaceMemberDomain.validateWorkspaceMemberGuard.mockResolvedValue(
            member
        );

        await guard.canActivate(context);

        expect(requestStoreService.set).toHaveBeenCalledWith(
            PolicyStoreKey,
            policies
        );
    });

    it('stores an empty policy list when the workspace role carries none', async () => {
        requestStoreService.get.mockReturnValue(undefined);
        workspaceMemberDomain.validateWorkspaceMemberGuard.mockResolvedValue({
            ...member,
            role: { ...member.role, policies: [] },
        });

        await guard.canActivate(context);

        expect(requestStoreService.set).toHaveBeenCalledWith(
            PolicyStoreKey,
            []
        );
    });

    it('passes null identifiers when prerequisite guards did not store context', async () => {
        requestStoreService.get.mockReturnValue(undefined);
        workspaceMemberDomain.validateWorkspaceMemberGuard.mockResolvedValue(
            member
        );

        await expect(guard.canActivate(context)).resolves.toBe(true);
        expect(
            workspaceMemberDomain.validateWorkspaceMemberGuard
        ).toHaveBeenCalledWith(null, null);
    });

    it.each([
        {
            name: 'only the workspace is stored',
            workspace: { id: 'workspace-id' },
            user: undefined,
            expected: ['workspace-id', null],
        },
        {
            name: 'only the user is stored',
            workspace: undefined,
            user: { id: 'user-id' },
            expected: [null, 'user-id'],
        },
    ])(
        'passes null for the missing identifier when $name',
        async ({ workspace, user, expected }) => {
            requestStoreService.get.mockImplementation((key: unknown) => {
                if (key === WorkspaceStoreKey) return workspace;
                if (key === UserStoreKey) return user;
                return undefined;
            });
            workspaceMemberDomain.validateWorkspaceMemberGuard.mockResolvedValue(
                member
            );

            await expect(guard.canActivate(context)).resolves.toBe(true);

            expect(
                workspaceMemberDomain.validateWorkspaceMemberGuard
            ).toHaveBeenCalledWith(...expected);
        }
    );

    it('propagates the domain rejection unchanged and publishes nothing', async () => {
        const error = new Error('not a workspace member');
        requestStoreService.get.mockImplementation((key: unknown) => {
            if (key === WorkspaceStoreKey) return { id: 'workspace-id' };
            if (key === UserStoreKey) return { id: 'user-id' };
            return undefined;
        });
        workspaceMemberDomain.validateWorkspaceMemberGuard.mockRejectedValue(
            error
        );

        await expect(guard.canActivate(context)).rejects.toBe(error);
        expect(requestStoreService.set).not.toHaveBeenCalled();
    });
});
