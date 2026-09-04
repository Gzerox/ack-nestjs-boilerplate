import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { RoleCreateRequestDto } from '@modules/role/dtos/request/role.create.request.dto';
import { RoleUpdateRequestDto } from '@modules/role/dtos/request/role.update.request.dto';
import {
    IRole,
    IRoleWithAbilities,
} from '@modules/role/interfaces/role.interface';
import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@generated/prisma-client';

@Injectable()
export class RoleRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findWithPaginationOffsetByAdmin(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<
            Prisma.RoleSelect,
            Prisma.RoleWhereInput
        >,
        type?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<IRoleWithAbilities>> {
        return this.paginationService.offset<
            IRoleWithAbilities,
            Prisma.RoleSelect,
            Prisma.RoleWhereInput
        >(this.databaseService.client.role, {
            ...params,
            include: { abilities: true },
            where: {
                ...where,
                ...type,
            },
        });
    }

    async findWithPaginationCursor(
        {
            where,
            ...params
        }: IPaginationQueryCursorParams<
            Prisma.RoleSelect,
            Prisma.RoleWhereInput
        >,
        type?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<IRoleWithAbilities>> {
        return this.paginationService.cursor<
            IRoleWithAbilities,
            Prisma.RoleSelect,
            Prisma.RoleWhereInput
        >(this.databaseService.client.role, {
            ...params,
            include: { abilities: true },
            where: {
                ...where,
                ...type,
            },
        });
    }

    async findOneById(id: string): Promise<IRoleWithAbilities | null> {
        return this.databaseService.client.role.findUnique({
            where: { id },
            include: { abilities: true },
        });
    }

    async existByName(name: string): Promise<IRole | null> {
        return this.databaseService.client.role.findFirst({
            where: {
                name: name,
            },
            select: { id: true, type: true, name: true },
        });
    }

    async existById(id: string): Promise<IRole | null> {
        return this.databaseService.client.role.findUnique({
            where: {
                id,
            },
            select: { id: true, type: true, name: true },
        });
    }

    async used(id: string): Promise<{ id: string } | null> {
        return this.databaseService.client.role.findFirst({
            where: {
                users: {
                    some: {
                        roleId: id,
                    },
                },
            },
            select: { id: true },
        });
    }

    async create({
        name,
        abilities,
        ...others
    }: RoleCreateRequestDto): Promise<IRoleWithAbilities> {
        return this.databaseService.client.role.create({
            data: {
                name: name,
                abilities: {
                    createMany: {
                        data: abilities.flatMap(ability =>
                            ability.action.map(action => ({
                                subject: ability.subject,
                                action,
                            }))
                        ),
                    },
                },
                ...others,
            },
            include: { abilities: true },
        });
    }

    async update(
        id: string,
        { abilities, ...others }: RoleUpdateRequestDto
    ): Promise<IRoleWithAbilities> {
        return this.databaseService.client.role.update({
            where: { id },
            data: {
                abilities: {
                    deleteMany: {},
                    createMany: {
                        data: abilities.flatMap(ability =>
                            ability.action.map(action => ({
                                subject: ability.subject,
                                action,
                            }))
                        ),
                    },
                },
                ...others,
            },
            include: { abilities: true },
        });
    }

    async delete(id: string): Promise<Role> {
        return this.databaseService.client.role.delete({ where: { id } });
    }
}
