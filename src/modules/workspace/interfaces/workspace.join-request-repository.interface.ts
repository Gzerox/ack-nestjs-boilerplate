import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    IPaginationCursorReturn,
    IPaginationIn,
    IPaginationQueryCursorParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    EnumWorkspaceJoinRejectReason,
    Prisma,
} from '@generated/prisma-client/client';
import type { WorkspaceJoinRequest } from '@generated/prisma-client/client';
import type { IWorkspaceJoinRequestCreateData } from '@modules/workspace/interfaces/workspace.interface';

export interface IWorkspaceJoinRequestRepository {
    existsPendingByWorkspaceAndUser(
        workspaceId: string,
        userId: string
    ): Promise<boolean>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findByIdAndWorkspace(
        workspaceJoinRequestId: string,
        workspaceId: string,
        additionalWhere?: Prisma.WorkspaceJoinRequestWhereInput
    ): Promise<WorkspaceJoinRequest | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPaginationCursor(
        workspaceId: string,
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<Prisma.WorkspaceJoinRequestWhereInput>,
        status?: Record<string, IPaginationIn>,
        additionalWhere?: Prisma.WorkspaceJoinRequestWhereInput
    ): Promise<IPaginationCursorReturn<WorkspaceJoinRequest>>;
    createPending({
        workspaceId,
        userId,
        message,
    }: IWorkspaceJoinRequestCreateData): Promise<WorkspaceJoinRequest>;
    /** Extra caller-supplied constraint, AND-composed first. */
    acceptInTx(
        tx: IDatabaseTransactionClient,
        workspaceJoinRequestId: string,
        reviewerId: string,
        reviewedAt: Date,
        additionalWhere?: Prisma.WorkspaceJoinRequestWhereInput
    ): Promise<WorkspaceJoinRequest | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    reject(
        workspaceJoinRequestId: string,
        reviewerId: string,
        rejectReasonCode: EnumWorkspaceJoinRejectReason,
        reviewedAt: Date,
        additionalWhere?: Prisma.WorkspaceJoinRequestWhereInput
    ): Promise<WorkspaceJoinRequest | null>;
    cancelPendingByWorkspaceInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string
    ): Promise<void>;
}
