import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { EnumRoleScope, Prisma } from '@generated/prisma-client/client';
import {
    RoleCursorAvailableOrderBy,
    RoleDefaultAvailableOrderBy,
    RoleDefaultAvailableSearch,
    RoleDefaultScope,
} from '@modules/role/constants/role.list.constant';
import { RoleDomain } from '@modules/role/domains/role.domain';
import { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';
import type { IResponsePaginationReturn } from '@common/response/interfaces/response.interface';
import type { IRoleSharedList } from '@modules/role/interfaces/role.interface';
import { RoleHttpService } from '@modules/role/services/role.http.service';

describe('RoleHttpService', () => {
    const roleDomain: MockProxy<RoleDomain> = mock<RoleDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const roleRow = {
        id: 'role-id',
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.admin,
        name: 'Admin',
        description: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        _count: { policies: 3 },
    };
    const listedRole = {
        id: 'role-id',
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.admin,
        name: 'Admin',
        description: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        policies: 3,
    };
    const offsetParams = {
        where: undefined,
        limit: 20,
        skip: 0,
        orderBy: [],
    };
    const offsetStorePatch = {
        page: 1,
        perPage: 20,
        orderBy: [],
        availableSearch: [],
        availableOrderBy: ['createdAt'],
        filters: {},
    };
    const cursorParams = {
        where: undefined,
        limit: 20,
        cursor: undefined,
        cursorField: 'id',
        orderBy: [],
    };
    const cursorStorePatch = {
        perPage: 20,
        cursor: undefined,
        orderBy: [],
        availableSearch: [],
        availableOrderBy: ['createdAt'],
        filters: {},
    };

    let service: RoleHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RoleHttpService,
                { provide: RoleDomain, useValue: roleDomain },
                { provide: PaginationQueryUtil, useValue: paginationQueryUtil },
                { provide: RequestStoreService, useValue: requestStoreService },
            ],
        }).compile();

        service = module.get(RoleHttpService);
    });

    describe('getListOffsetByAdmin', () => {
        it('filters by scope, merges the filter into the store and maps the policy count', async () => {
            const query = { scope: 'workspace,project' };
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue({
                where: { scope: { in: ['workspace', 'project'] } },
                storeFilter: { scope: ['workspace', 'project'] },
            } as never);
            roleDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [roleRow],
            });

            const result = await service.getListOffsetByAdmin(query);

            expect(paginationQueryUtil.offset).toHaveBeenCalledWith(query, {
                availableSearch: RoleDefaultAvailableSearch,
                availableOrderBy: RoleDefaultAvailableOrderBy,
            });
            expect(paginationQueryUtil.inEnum).toHaveBeenCalledWith(
                Prisma.RoleScalarFieldEnum.scope,
                'workspace,project',
                RoleDefaultScope
            );
            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...offsetStorePatch,
                    filters: { scope: ['workspace', 'project'] },
                }
            );
            expect(roleDomain.getListOffsetByAdmin).toHaveBeenCalledWith(
                offsetParams,
                { scope: { in: ['workspace', 'project'] } }
            );
            expect(result.data).toEqual([listedRole]);
        });

        it('applies no scope filter when the query carries none', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue(undefined);
            roleDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 0,
                perPage: 20,
                page: 1,
                totalPage: 0,
                hasNext: false,
                hasPrevious: false,
                data: [],
            });

            await service.getListOffsetByAdmin({});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { ...offsetStorePatch, filters: {} }
            );
            expect(roleDomain.getListOffsetByAdmin).toHaveBeenCalledWith(
                offsetParams,
                undefined
            );
        });
    });

    describe('getListCursorBySystem', () => {
        it('orders by the cursor allow-list, filters by scope and maps the policy count', async () => {
            const query = { scope: 'platform' };
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue({
                where: { scope: { in: ['platform'] } },
                storeFilter: { scope: ['platform'] },
            } as never);
            roleDomain.getListCursorBySystem.mockResolvedValue({
                type: EnumPaginationType.cursor,
                count: 1,
                perPage: 20,
                hasNext: false,
                cursor: undefined,
                data: [roleRow],
            });

            const result = await service.getListCursorBySystem(query);

            expect(paginationQueryUtil.cursor).toHaveBeenCalledWith(query, {
                availableSearch: RoleDefaultAvailableSearch,
                availableOrderBy: RoleCursorAvailableOrderBy,
            });
            expect(paginationQueryUtil.inEnum).toHaveBeenCalledWith(
                Prisma.RoleScalarFieldEnum.scope,
                'platform',
                RoleDefaultScope
            );
            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...cursorStorePatch,
                    filters: { scope: ['platform'] },
                }
            );
            expect(roleDomain.getListCursorBySystem).toHaveBeenCalledWith(
                cursorParams,
                { scope: { in: ['platform'] } }
            );
            expect(result.data).toEqual([listedRole]);
        });

        it('applies no scope filter when the query carries none', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue(undefined);
            roleDomain.getListCursorBySystem.mockResolvedValue({
                type: EnumPaginationType.cursor,
                count: 0,
                perPage: 20,
                hasNext: false,
                cursor: undefined,
                data: [],
            });

            await service.getListCursorBySystem({});

            expect(roleDomain.getListCursorBySystem).toHaveBeenCalledWith(
                cursorParams,
                undefined
            );
        });
    });

    describe('getListShared', () => {
        it('orders by the cursor allow-list, filters by the requested scope and returns the page unchanged', async () => {
            const query = { scope: EnumRoleScope.workspace };
            const page: IResponsePaginationReturn<IRoleSharedList> = {
                type: EnumPaginationType.cursor,
                count: 1,
                perPage: 20,
                hasNext: false,
                cursor: undefined,
                data: [
                    {
                        id: 'role-id',
                        key: 'owner',
                        name: 'Owner',
                        createdAt: now,
                    },
                ],
            };
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.equalString.mockReturnValue({
                where: { scope: { equals: 'workspace' } },
                storeFilter: { scope: 'workspace' },
            } as never);
            roleDomain.getListCursorShared.mockResolvedValue(page);

            const result = await service.getListShared(query);

            expect(paginationQueryUtil.cursor).toHaveBeenCalledWith(query, {
                availableOrderBy: RoleCursorAvailableOrderBy,
            });
            expect(paginationQueryUtil.equalString).toHaveBeenCalledWith(
                Prisma.RoleScalarFieldEnum.scope,
                'workspace'
            );
            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...cursorStorePatch,
                    filters: { scope: 'workspace' },
                }
            );
            expect(roleDomain.getListCursorShared).toHaveBeenCalledWith(
                cursorParams,
                { scope: { equals: 'workspace' } }
            );
            expect(result).toBe(page);
        });
    });

    describe('getOne', () => {
        it('wraps the role from the domain', async () => {
            const withPolicies = { ...roleRow, policies: [] };
            roleDomain.getOne.mockResolvedValue(withPolicies);

            await expect(service.getOne('role-id')).resolves.toEqual({
                data: withPolicies,
            });
            expect(roleDomain.getOne).toHaveBeenCalledWith('role-id');
        });
    });

    describe('updateByAdmin', () => {
        it('forwards the body to the domain and wraps the result', async () => {
            const body = { name: 'Editor', description: 'Edits' };
            const updated = { ...roleRow, ...body, policies: [] };
            roleDomain.updateByAdmin.mockResolvedValue(updated);

            await expect(
                service.updateByAdmin('role-id', body)
            ).resolves.toEqual({ data: updated });
            expect(roleDomain.updateByAdmin).toHaveBeenCalledWith(
                'role-id',
                body
            );
        });
    });
});
