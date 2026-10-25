import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import {
    EnumPolicyAction,
    EnumPolicySubject,
    Prisma,
} from '@generated/prisma-client/client';
import type { Workspace } from '@generated/prisma-client/client';
import { PolicyAbilityDomain } from '@modules/policy/domains/policy.ability.domain';
import {
    WorkspaceMemberDefaultAvailableOrderBy,
    WorkspaceMemberDefaultRole,
} from '@modules/workspace/constants/workspace.list.constant';
import type { WorkspaceAdminMemberListRequestDto } from '@modules/workspace/dtos/request/workspace.admin-member-list.request.dto';
import type { WorkspaceMemberListRequestDto } from '@modules/workspace/dtos/request/workspace.member-list.request.dto';
import type { WorkspaceMemberUpdateRoleRequestDto } from '@modules/workspace/dtos/request/workspace.member-update-role.request.dto';
import type { WorkspaceTransferOwnershipRequestDto } from '@modules/workspace/dtos/request/workspace.transfer-ownership.request.dto';
import type {
    IWorkspaceMember,
    IWorkspaceMemberWithRole,
} from '@modules/workspace/interfaces/workspace.interface';
import { WorkspaceDomain } from '@modules/workspace/domains/workspace.domain';
import { WorkspaceMemberDomain } from '@modules/workspace/domains/workspace.member.domain';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceMemberHttpService {
    constructor(
        private readonly workspaceMemberDomain: WorkspaceMemberDomain,
        private readonly workspaceDomain: WorkspaceDomain,
        private readonly policyAbilityDomain: PolicyAbilityDomain,
        private readonly paginationQueryUtil: PaginationQueryUtil,
        private readonly requestStoreService: RequestStoreService
    ) {}

    async transferOwnership(
        workspace: Workspace,
        actorMember: IWorkspaceMemberWithRole,
        { targetUserId }: WorkspaceTransferOwnershipRequestDto
    ): Promise<void> {
        const scopeWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.update,
            EnumPolicySubject.Workspace
        );
        await this.workspaceMemberDomain.transferOwnership(
            workspace.id,
            actorMember,
            targetUserId,
            scopeWhere
        );
    }

    async leaveWorkspace(
        workspaceId: string,
        member: IWorkspaceMemberWithRole
    ): Promise<void> {
        await this.workspaceMemberDomain.leaveWorkspace(workspaceId, member);
    }

    async getMembersList(
        workspaceId: string,
        query: WorkspaceMemberListRequestDto
    ): Promise<IResponsePaginationReturn<IWorkspaceMember>> {
        const scopeWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.read,
            EnumPolicySubject.WorkspaceMember
        );

        const { params, storePatch } =
            this.paginationQueryUtil.cursor<Prisma.WorkspaceMemberWhereInput>(
                query,
                {
                    availableOrderBy: WorkspaceMemberDefaultAvailableOrderBy,
                }
            );
        const role = this.paginationQueryUtil.inEnum(
            'role',
            query.role,
            WorkspaceMemberDefaultRole
        );
        this.requestStoreService.merge(PaginationStoreKey, {
            ...storePatch,
            filters: {
                ...storePatch.filters,
                ...(role?.storeFilter ?? {}),
            },
        });

        const { data, ...others } =
            await this.workspaceMemberDomain.getMembersList(
                workspaceId,
                params,
                role?.where,
                scopeWhere
            );

        return {
            data,
            ...others,
        };
    }

    async updateMemberRole(
        workspaceId: string,
        actorMember: IWorkspaceMemberWithRole,
        targetMemberId: string,
        { roleId }: WorkspaceMemberUpdateRoleRequestDto
    ): Promise<void> {
        const scopeWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.update,
            EnumPolicySubject.WorkspaceMember
        );
        const targetMember =
            await this.workspaceMemberDomain.getOneByIdAndWorkspace(
                workspaceId,
                targetMemberId,
                scopeWhere
            );
        await this.workspaceMemberDomain.updateMemberRole(
            workspaceId,
            actorMember,
            targetMember,
            roleId,
            scopeWhere
        );
    }

    async removeMember(
        workspaceId: string,
        actorMember: IWorkspaceMemberWithRole,
        targetMemberId: string
    ): Promise<void> {
        const scopeWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.delete,
            EnumPolicySubject.WorkspaceMember
        );
        const targetMember =
            await this.workspaceMemberDomain.getOneByIdAndWorkspace(
                workspaceId,
                targetMemberId,
                scopeWhere
            );
        await this.workspaceMemberDomain.removeMember(
            workspaceId,
            actorMember,
            targetMember,
            scopeWhere
        );
    }

    async getMembersListForAdmin(
        workspaceId: string,
        query: WorkspaceAdminMemberListRequestDto
    ): Promise<IResponsePaginationReturn<IWorkspaceMember>> {
        const workspaceWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.read,
            EnumPolicySubject.Workspace
        );
        await this.workspaceDomain.getByIdForAdmin(workspaceId, workspaceWhere);

        const scopeWhere = this.policyAbilityDomain.scope(
            EnumPolicyAction.read,
            EnumPolicySubject.WorkspaceMember
        );

        const { params, storePatch } =
            this.paginationQueryUtil.offset<Prisma.WorkspaceMemberWhereInput>(
                query,
                {
                    availableOrderBy: WorkspaceMemberDefaultAvailableOrderBy,
                }
            );
        this.requestStoreService.merge(PaginationStoreKey, storePatch);

        const { data, ...others } =
            await this.workspaceMemberDomain.getMembersListForAdmin(
                workspaceId,
                params,
                scopeWhere
            );

        return {
            data,
            ...others,
        };
    }
}
