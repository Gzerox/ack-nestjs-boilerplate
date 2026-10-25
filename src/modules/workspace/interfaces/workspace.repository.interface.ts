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
    findActiveById(workspaceId: string): Promise<Workspace | null>;
    findActivePublicBySlug(slug: string): Promise<Workspace | null>;
    /** Extra caller-supplied constraint, AND-composed first. */
    findByIdForAdmin(
        workspaceId: string,
        additionalWhere?: Prisma.WorkspaceWhereInput
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
        isPublic?: Record<string, IPaginationEqual>,
        additionalWhere?: Prisma.WorkspaceWhereInput
    ): Promise<IResponsePaginationReturn<Workspace>>;
    createInTx(
        tx: IDatabaseTransactionClient,
        ownerId: string,
        { name, description, isPublic }: WorkspaceCreateRequestDto,
        slug: string,
        workspaceId: string
    ): Promise<Workspace>;
    updateDetails(
        workspaceId: string,
        { name, description }: WorkspaceUpdateRequestDto
    ): Promise<Workspace>;
    updateIsPublic(workspaceId: string, isPublic: boolean): Promise<Workspace>;
    updateSlug(workspaceId: string, slug: string): Promise<Workspace>;
    softDeleteInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        deletedAt: Date
    ): Promise<void>;
}
