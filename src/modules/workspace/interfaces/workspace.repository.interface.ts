import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import type {
    IPaginationCursorReturn,
    IPaginationEqual,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client/client';
import type { Workspace } from '@generated/prisma-client/client';
import type { WorkspaceCreateRequestDto } from '@modules/workspace/dtos/request/workspace.create.request.dto';
import type { WorkspaceUpdateRequestDto } from '@modules/workspace/dtos/request/workspace.update.request.dto';

export interface IWorkspaceRepository {
    /** Extra caller-supplied constraint, AND-composed first. */
    findActiveById(
        workspaceId: string,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
    findActivePublicBySlug(slug: string): Promise<Workspace | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findByIdForAdmin(
        workspaceId: string,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
    existsBySlug(slug: string, excludeWorkspaceId?: string): Promise<boolean>;
    findWithPaginationCursorByMember(
        userId: string,
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<Prisma.WorkspaceWhereInput>
    ): Promise<IPaginationCursorReturn<Workspace>>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findWithPaginationOffsetForAdmin(
        params: IPaginationQueryOffsetParams<Prisma.WorkspaceWhereInput>,
        isPublic: Record<string, IPaginationEqual> | undefined,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<IResponsePaginationReturn<Workspace>>;
    createInTx(
        tx: IDatabaseTransactionClient,
        ownerId: string,
        { name, description, isPublic }: WorkspaceCreateRequestDto,
        slug: string,
        workspaceId: string
    ): Promise<Workspace>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateDetails(
        workspaceId: string,
        { name, description }: WorkspaceUpdateRequestDto,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateIsPublic(
        workspaceId: string,
        isPublic: boolean,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    updateSlug(
        workspaceId: string,
        slug: string,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    softDeleteInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        deletedAt: Date,
        deletedBy: string,
        additionalWhere: Prisma.WorkspaceWhereInput
    ): Promise<Workspace | null>;
}
