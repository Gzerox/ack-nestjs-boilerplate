import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import { DatabaseService } from '@common/database/services/database.service';
import type { IPaginationQueryCursorParams } from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import { EnumRoleScope, Prisma } from '@generated/prisma-client/client';
import type { ProjectMember } from '@generated/prisma-client/client';
import { ProjectMemberRoleInclude } from '@modules/project/constants/project.constant';
import type {
    IProjectMember,
    IProjectMemberWithRole,
} from '@modules/project/interfaces/project.interface';
import { EnumRoleProjectKey } from '@modules/role/enums/role.project-key.enum';
import { RoleSelect } from '@modules/role/constants/role.constant';
import { UserRefSelect } from '@modules/user/constants/user.constant';
import type { IProjectMemberRepository } from '@modules/project/interfaces/project.member-repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectMemberRepository implements IProjectMemberRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findOneByProjectAndUser(
        projectId: string,
        userId: string
    ): Promise<ProjectMember | null> {
        return this.databaseService.client.projectMember.findFirst({
            where: {
                projectId,
                userId,
            },
        });
    }

    async findOneWithRoleByProjectAndUser(
        projectId: string,
        userId: string
    ): Promise<IProjectMemberWithRole | null> {
        return this.databaseService.client.projectMember.findFirst({
            where: {
                projectId,
                userId,
            },
            include: ProjectMemberRoleInclude,
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findByIdAndProject(
        projectMemberId: string,
        projectId: string,
        additionalWhere?: Prisma.ProjectMemberWhereInput
    ): Promise<IProjectMemberWithRole | null> {
        return this.databaseService.client.projectMember.findFirst({
            where: {
                AND: [
                    additionalWhere ?? {},
                    { id: projectMemberId },
                    { projectId },
                ],
            },
            include: ProjectMemberRoleInclude,
        });
    }

    async countAdmins(projectId: string): Promise<number> {
        return this.databaseService.client.projectMember.count({
            where: {
                projectId,
                role: {
                    scope: EnumRoleScope.project,
                    key: EnumRoleProjectKey.admin,
                },
            },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findWithPaginationCursor(
        projectId: string,
        {
            where,
            ...others
        }: IPaginationQueryCursorParams<Prisma.ProjectMemberWhereInput>,
        additionalWhere?: Prisma.ProjectMemberWhereInput
    ): Promise<IResponsePaginationReturn<IProjectMember>> {
        return this.paginationService.cursor<
            IProjectMember,
            Prisma.ProjectMemberWhereInput
        >(this.databaseService.client.projectMember, {
            ...others,
            where: {
                AND: [
                    additionalWhere ?? {},
                    {
                        ...where,
                        projectId,
                    },
                ],
            },
            include: {
                user: {
                    select: UserRefSelect,
                },
                role: {
                    select: RoleSelect,
                },
            },
        });
    }

    async create(
        projectId: string,
        userId: string,
        roleId: string,
        createdBy: string
    ): Promise<IProjectMember> {
        return this.databaseService.client.projectMember.create({
            data: {
                projectId,
                userId,
                roleId,
                createdBy,
            },
            include: {
                user: {
                    select: UserRefSelect,
                },
                role: {
                    select: RoleSelect,
                },
            },
        });
    }

    async createInTx(
        tx: IDatabaseTransactionClient,
        projectId: string,
        userId: string,
        roleId: string,
        createdBy: string
    ): Promise<IProjectMember> {
        return tx.projectMember.create({
            data: {
                projectId,
                userId,
                roleId,
                createdBy,
            },
            include: {
                user: {
                    select: UserRefSelect,
                },
                role: {
                    select: RoleSelect,
                },
            },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async updateRole(
        targetMemberId: string,
        roleId: string,
        additionalWhere?: Prisma.ProjectMemberWhereInput
    ): Promise<ProjectMember | null> {
        const { count } =
            await this.databaseService.client.projectMember.updateMany({
                where: {
                    AND: [additionalWhere ?? {}, { id: targetMemberId }],
                },
                data: {
                    roleId,
                },
            });
        if (count === 0) {
            return null;
        }

        return this.databaseService.client.projectMember.findUnique({
            where: { id: targetMemberId },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async removeMember(
        targetMemberId: string,
        additionalWhere?: Prisma.ProjectMemberWhereInput
    ): Promise<ProjectMember | null> {
        return this.databaseService.withTransaction(async tx => {
            const where: Prisma.ProjectMemberWhereInput = {
                AND: [additionalWhere ?? {}, { id: targetMemberId }],
            };
            const existing = await tx.projectMember.findFirst({ where });
            if (!existing) {
                return null;
            }

            const { count } = await tx.projectMember.deleteMany({ where });

            return count > 0 ? existing : null;
        });
    }
}
