import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import { DatabaseService } from '@common/database/services/database.service';
import type {
    IPaginationEqual,
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type {
    IRole,
    IRoleCreate,
    IRoleUpdate,
    IRoleWithPolicies,
    IRoleWithPolicyCount,
} from '@modules/role/interfaces/role.interface';
import {
    RolePoliciesInclude,
    RoleSelect,
    RoleUsageCountSelect,
} from '@modules/role/constants/role.constant';
import type { IRoleRepository } from '@modules/role/interfaces/role.repository.interface';
import { Injectable } from '@nestjs/common';
import type {
    EnumRoleScope,
    Prisma,
    Role,
} from '@generated/prisma-client/client';

@Injectable()
export class RoleRepository implements IRoleRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    /** Extra caller-supplied constraint, AND-composed first. */
    async findWithPaginationOffsetByAdmin(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<Prisma.RoleWhereInput>,
        scope?: Record<string, IPaginationIn>,
        additionalWhere?: Prisma.RoleWhereInput
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>> {
        return this.paginationService.offset<
            IRoleWithPolicyCount,
            Prisma.RoleWhereInput
        >(this.databaseService.client.role, {
            ...params,
            where: {
                AND: [
                    additionalWhere ?? {},
                    {
                        ...where,
                        ...scope,
                    },
                ],
            },
            include: { _count: { select: { policies: true } } },
        });
    }

    async findWithPaginationCursorBySystem(
        {
            where,
            ...params
        }: IPaginationQueryCursorParams<Prisma.RoleWhereInput>,
        scope?: Record<string, IPaginationIn>
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>> {
        return this.paginationService.cursor<
            IRoleWithPolicyCount,
            Prisma.RoleWhereInput
        >(this.databaseService.client.role, {
            ...params,
            where: {
                ...where,
                ...scope,
            },
            include: { _count: { select: { policies: true } } },
        });
    }

    async findWithPaginationOffsetByShared(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<Prisma.RoleWhereInput>,
        scope?: Record<string, IPaginationEqual>
    ): Promise<IResponsePaginationReturn<IRoleWithPolicyCount>> {
        return this.paginationService.offset<
            IRoleWithPolicyCount,
            Prisma.RoleWhereInput
        >(this.databaseService.client.role, {
            ...params,
            where: {
                ...where,
                ...scope,
            },
            include: { _count: { select: { policies: true } } },
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findOneWithPoliciesById(
        id: string,
        additionalWhere?: Prisma.RoleWhereInput
    ): Promise<IRoleWithPolicies | null> {
        return this.databaseService.client.role.findFirst({
            where: { AND: [additionalWhere ?? {}, { id }] },
            include: RolePoliciesInclude,
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async findOneById(
        id: string,
        additionalWhere?: Prisma.RoleWhereInput
    ): Promise<IRole | null> {
        return this.databaseService.client.role.findFirst({
            where: { AND: [additionalWhere ?? {}, { id }] },
            select: RoleSelect,
        });
    }

    async findManyByIds(ids: string[]): Promise<IRole[]> {
        return this.databaseService.client.role.findMany({
            where: { id: { in: ids } },
            select: RoleSelect,
        });
    }

    async findOneByIdInTx(
        tx: IDatabaseTransactionClient,
        id: string
    ): Promise<IRole | null> {
        return tx.role.findUnique({
            where: { id },
            select: RoleSelect,
        });
    }

    async findOneByScopeAndKey(
        scope: EnumRoleScope,
        key: string
    ): Promise<IRole | null> {
        return this.databaseService.client.role.findUnique({
            where: { scope_key: { scope, key } },
            select: RoleSelect,
        });
    }

    async findOneByScopeAndKeyInTx(
        tx: IDatabaseTransactionClient,
        scope: EnumRoleScope,
        key: string
    ): Promise<IRole | null> {
        return tx.role.findUnique({
            where: { scope_key: { scope, key } },
            select: RoleSelect,
        });
    }

    async incrementPolicyRevisionInTx(
        tx: IDatabaseTransactionClient,
        roleId: string
    ): Promise<void> {
        await tx.role.update({
            where: { id: roleId },
            data: { policyRevision: { increment: 1 } },
        });
    }

    async existsByScopeAndKey(
        scope: EnumRoleScope,
        key: string
    ): Promise<boolean> {
        const role = await this.databaseService.client.role.findUnique({
            where: { scope_key: { scope, key } },
            select: { id: true },
        });

        return role !== null;
    }

    async create(data: IRoleCreate): Promise<IRoleWithPolicies> {
        return this.databaseService.client.role.create({
            data,
            include: RolePoliciesInclude,
        });
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async update(
        id: string,
        data: IRoleUpdate,
        additionalWhere?: Prisma.RoleWhereInput
    ): Promise<IRoleWithPolicies | null> {
        return this.databaseService.withTransaction(async tx => {
            const { count } = await tx.role.updateMany({
                where: { AND: [additionalWhere ?? {}, { id }] },
                data,
            });
            if (count === 0) {
                return null;
            }

            return tx.role.findUnique({
                where: { id },
                include: RolePoliciesInclude,
            });
        });
    }

    async isUsedById(id: string): Promise<boolean> {
        const role = await this.databaseService.client.role.findUnique({
            where: { id },
            select: RoleUsageCountSelect,
        });
        if (!role) {
            return false;
        }

        return Object.values(role._count).some(count => count > 0);
    }

    /** Extra caller-supplied constraint, AND-composed first. */
    async delete(
        id: string,
        additionalWhere?: Prisma.RoleWhereInput
    ): Promise<Role | null> {
        return this.databaseService.withTransaction(async tx => {
            const where: Prisma.RoleWhereInput = {
                AND: [additionalWhere ?? {}, { id }],
            };
            const existing = await tx.role.findFirst({ where });
            if (!existing) {
                return null;
            }

            const { count } = await tx.role.deleteMany({ where });

            return count > 0 ? existing : null;
        });
    }
}
