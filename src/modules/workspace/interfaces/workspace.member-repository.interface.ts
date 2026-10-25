import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    IPaginationCursorReturn,
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type { Prisma, WorkspaceMember } from '@generated/prisma-client/client';
import type {
    IWorkspaceMember,
    IWorkspaceMemberWithGuardRole,
    IWorkspaceMemberWithRole,
} from '@modules/workspace/interfaces/workspace.interface';

export interface IWorkspaceMemberRepository {
    findOneWithRoleByWorkspaceAndUser(
        workspaceId: string,
        userId: string
    ): Promise<IWorkspaceMemberWithGuardRole | null>;
    findOneByWorkspaceAndUser(
        workspaceId: string,
        userId: string
    ): Promise<WorkspaceMember | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findByIdAndWorkspace(
        workspaceMemberId: string,
        workspaceId: string,
        additionalWhere?: Prisma.WorkspaceMemberWhereInput
    ): Promise<IWorkspaceMemberWithRole | null>;
    countOwnedActiveByUser(userId: string): Promise<number>;
    countOwners(workspaceId: string): Promise<number>;
    findReviewersByWorkspace(
        workspaceId: string
    ): Promise<{ userId: string }[]>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPaginationOffset(
        workspaceId: string,
        params: IPaginationQueryOffsetParams<Prisma.WorkspaceMemberWhereInput>,
        additionalWhere?: Prisma.WorkspaceMemberWhereInput
    ): Promise<IResponsePaginationReturn<IWorkspaceMember>>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPaginationCursor(
        workspaceId: string,
        params: IPaginationQueryCursorParams<Prisma.WorkspaceMemberWhereInput>,
        role?: Record<string, IPaginationIn>,
        additionalWhere?: Prisma.WorkspaceMemberWhereInput
    ): Promise<IPaginationCursorReturn<IWorkspaceMember>>;
    createOwnerInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        userId: string,
        roleId: string
    ): Promise<WorkspaceMember>;
    createInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        userId: string,
        roleId: string,
        actorId: string
    ): Promise<WorkspaceMember>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateRole(
        targetMemberId: string,
        roleId: string,
        additionalWhere?: Prisma.WorkspaceMemberWhereInput
    ): Promise<WorkspaceMember | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    removeMember(
        targetMemberId: string,
        additionalWhere?: Prisma.WorkspaceMemberWhereInput
    ): Promise<WorkspaceMember | null>;
    /** Extra caller-supplied constraint on the workspace, AND-composed first. */
    transferOwnership(
        fromMemberId: string,
        toMemberId: string,
        ownerRoleId: string,
        adminRoleId: string,
        additionalWhere?: Prisma.WorkspaceWhereInput
    ): Promise<WorkspaceMember | null>;
}
