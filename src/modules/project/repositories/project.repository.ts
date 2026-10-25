import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import { DatabaseService } from '@common/database/services/database.service';
import type {
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client/client';
import type { Project } from '@generated/prisma-client/client';
import { ProjectActiveFilter } from '@modules/project/constants/project.constant';
import type { ProjectCreateRequestDto } from '@modules/project/dtos/request/project.create.request.dto';
import type { ProjectUpdateRequestDto } from '@modules/project/dtos/request/project.update.request.dto';
import type { IProjectRepository } from '@modules/project/interfaces/project.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectRepository implements IProjectRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    /** Extra caller-supplied constraint, AND-composed first. */
    async findActiveByIdAndWorkspace(
        projectId: string,
        workspaceId: string,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<Project | null> {
        return this.databaseService.client.project.findFirst({
            where: {
                AND: [
                    additionalWhere ?? {},
                    { id: projectId },
                    { workspaceId },
                    ProjectActiveFilter,
                ],
            },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findByIdForAdmin(
        projectId: string,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<Project | null> {
        return this.databaseService.client.project.findFirst({
            where: { AND: [additionalWhere ?? {}, { id: projectId }] },
        });
    }

    /** Counts slug holders across ALL rows including soft-deleted ones, matching the unique index, which has no `deletedAt` component. */
    async existsBySlugInWorkspace(
        workspaceId: string,
        slug: string,
        excludeProjectId?: string
    ): Promise<boolean> {
        const count = await this.databaseService.client.project.count({
            where: {
                workspaceId,
                slug,
                ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
            },
        });

        return count > 0;
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findWithPaginationCursorForWorkspace(
        workspaceId: string,
        {
            where: filters,
            ...others
        }: IPaginationQueryCursorParams<Prisma.ProjectWhereInput>,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<IResponsePaginationReturn<Project>> {
        return this.paginationService.cursor<Project, Prisma.ProjectWhereInput>(
            this.databaseService.client.project,
            {
                ...others,
                where: {
                    AND: [
                        additionalWhere ?? {},
                        filters ?? {},
                        { workspaceId },
                        ProjectActiveFilter,
                    ],
                },
            }
        );
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findWithPaginationOffsetForAdmin(
        {
            where: filters,
            ...others
        }: IPaginationQueryOffsetParams<Prisma.ProjectWhereInput>,
        workspaceId?: string,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<IResponsePaginationReturn<Project>> {
        return this.paginationService.offset<Project, Prisma.ProjectWhereInput>(
            this.databaseService.client.project,
            {
                ...others,
                where: {
                    AND: [
                        additionalWhere ?? {},
                        filters ?? {},
                        ...(workspaceId ? [{ workspaceId }] : []),
                    ],
                },
            }
        );
    }

    async createInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        { name, description }: ProjectCreateRequestDto,
        slug: string
    ): Promise<Project> {
        return tx.project.create({
            data: {
                workspaceId,
                name,
                slug,
                description,
                deletedAt: null,
            },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async updateDetails(
        projectId: string,
        { name, description }: ProjectUpdateRequestDto,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<Project | null> {
        return this.databaseService.withTransaction(async tx => {
            const { count } = await tx.project.updateMany({
                where: { AND: [additionalWhere ?? {}, { id: projectId }] },
                data: {
                    name,
                    description,
                },
            });
            if (count === 0) {
                return null;
            }

            return tx.project.findUnique({
                where: { id: projectId },
            });
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async updateSlug(
        projectId: string,
        slug: string,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<Project | null> {
        return this.databaseService.withTransaction(async tx => {
            const { count } = await tx.project.updateMany({
                where: { AND: [additionalWhere ?? {}, { id: projectId }] },
                data: {
                    slug,
                },
            });
            if (count === 0) {
                return null;
            }

            return tx.project.findUnique({
                where: { id: projectId },
            });
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async softDelete(
        projectId: string,
        deletedAt: Date,
        deletedBy: string,
        additionalWhere?: Prisma.ProjectWhereInput
    ): Promise<Project | null> {
        return this.databaseService.withTransaction(async tx => {
            const { count } = await tx.project.updateMany({
                where: {
                    AND: [
                        additionalWhere ?? {},
                        { id: projectId },
                        ProjectActiveFilter,
                    ],
                },
                data: {
                    deletedAt,
                    deletedBy,
                },
            });
            if (count === 0) {
                return null;
            }

            return tx.project.findUnique({
                where: { id: projectId },
            });
        });
    }

    async softDeleteByWorkspaceInTx(
        tx: IDatabaseTransactionClient,
        workspaceId: string,
        deletedAt: Date,
        deletedBy: string
    ): Promise<void> {
        await tx.project.updateMany({
            where: {
                workspaceId,
                ...ProjectActiveFilter,
            },
            data: {
                deletedAt,
                deletedBy,
            },
        });
    }
}
