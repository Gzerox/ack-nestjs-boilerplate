import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';

import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import {
    EnumPolicyAction,
    EnumPolicySubject,
    EnumRoleScope,
    Prisma,
} from '@generated/prisma-client/client';
import {
    RoleCursorAvailableOrderBy,
    RoleDefaultAvailableOrderBy,
    RoleDefaultAvailableSearch,
    RoleDefaultScope,
} from '@modules/role/constants/role.list.constant';
import { RoleDomain } from '@modules/role/domains/role.domain';
import { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';
import { RoleHttpService } from '@modules/role/services/role.http.service';
import { PolicyAbilityStoreKey } from '@modules/policy/constants/policy.constant';
import { PolicyAbilityDomain } from '@modules/policy/domains/policy.ability.domain';
import { PolicyForbiddenException } from '@modules/policy/exceptions/policy.forbidden.exception';

describe('RoleHttpService', () => {
    const roleDomain: MockProxy<RoleDomain> = mock<RoleDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const policyAbilityDomain: MockProxy<PolicyAbilityDomain> =
        mock<PolicyAbilityDomain>();
    const scopeWhere = { scope: EnumRoleScope.workspace };
    const now = new Date('2026-01-01T00:00:00.000Z');
    const roleRow = {
        id: 'role-id',
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.admin,
        name: 'Admin',
        description: null,
        policyRevision: 0,
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
        policyRevision: 0,
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
        policyAbilityDomain.scope.mockReturnValue(scopeWhere);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RoleHttpService,
                { provide: RoleDomain, useValue: roleDomain },
                { provide: PolicyAbilityDomain, useValue: policyAbilityDomain },
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
                { scope: { in: ['workspace', 'project'] } },
                scopeWhere
            );
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.Role
            );
            expect(result.data).toEqual([listedRole]);
        });

        it('preserves the description of each role', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue(undefined);
            roleDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [{ ...roleRow, description: 'Full access' }],
            });

            const result = await service.getListOffsetByAdmin({});

            expect(result.data[0]?.description).toBe('Full access');
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
                undefined,
                scopeWhere
            );
        });

        it('propagates PolicyForbiddenException and skips the domain when the ability has no read rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(service.getListOffsetByAdmin({})).rejects.toThrow(
                PolicyForbiddenException
            );
            expect(roleDomain.getListOffsetByAdmin).not.toHaveBeenCalled();
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

    describe('getListOffsetByShared', () => {
        it('orders by the offset allow-list, filters by the requested scope and maps the policy count', async () => {
            const query = { scope: EnumRoleScope.workspace };
            const sharedRow = {
                ...roleRow,
                scope: EnumRoleScope.workspace,
                key: 'owner',
                name: 'Owner',
                description: 'Owns the workspace',
                policyRevision: 0,
            };
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalString.mockReturnValue({
                where: { scope: { equals: 'workspace' } },
                storeFilter: { scope: 'workspace' },
            } as never);
            roleDomain.getListOffsetByShared.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [sharedRow],
            });

            const result = await service.getListOffsetByShared(query);

            expect(paginationQueryUtil.offset).toHaveBeenCalledWith(query, {
                availableSearch: RoleDefaultAvailableSearch,
                availableOrderBy: RoleDefaultAvailableOrderBy,
            });
            expect(paginationQueryUtil.equalString).toHaveBeenCalledWith(
                Prisma.RoleScalarFieldEnum.scope,
                'workspace'
            );
            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...offsetStorePatch,
                    filters: { scope: 'workspace' },
                }
            );
            expect(roleDomain.getListOffsetByShared).toHaveBeenCalledWith(
                offsetParams,
                { scope: { equals: 'workspace' } }
            );
            expect(result.data).toEqual([
                {
                    ...listedRole,
                    scope: EnumRoleScope.workspace,
                    key: 'owner',
                    name: 'Owner',
                    description: 'Owns the workspace',
                    policyRevision: 0,
                },
            ]);
            expect(result.data[0]).not.toHaveProperty('_count');
        });
    });

    describe('getListOffsetByShared without a scope filter', () => {
        it('merges an empty filter set and passes an undefined scope to the domain when the helper yields no filter', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalString.mockReturnValue(undefined);
            roleDomain.getListOffsetByShared.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 0,
                perPage: 20,
                page: 1,
                totalPage: 0,
                hasNext: false,
                hasPrevious: false,
                data: [],
            });

            await service.getListOffsetByShared({
                scope: EnumRoleScope.workspace,
            });

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { ...offsetStorePatch, filters: {} }
            );
            expect(roleDomain.getListOffsetByShared).toHaveBeenCalledWith(
                offsetParams,
                undefined
            );
        });
    });

    describe('getOne', () => {
        const withPolicies = { ...roleRow, policies: [] };

        it('passes scope(read, Role) as additionalWhere and wraps the role', async () => {
            roleDomain.getOne.mockResolvedValue(withPolicies);

            await expect(service.getOne('role-id')).resolves.toEqual({
                data: withPolicies,
            });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.Role
            );
            expect(roleDomain.getOne).toHaveBeenCalledWith(
                'role-id',
                scopeWhere
            );
        });

        it.each([
            ['PolicyForbiddenException', new PolicyForbiddenException()],
            [
                'RequestContextMissingException',
                new RequestContextMissingException(PolicyAbilityStoreKey),
            ],
        ])(
            'propagates %s from scope and never calls the domain',
            async (_name, error) => {
                policyAbilityDomain.scope.mockImplementation(() => {
                    throw error;
                });

                await expect(service.getOne('role-id')).rejects.toThrow(error);
                expect(roleDomain.getOne).not.toHaveBeenCalled();
            }
        );
    });

    describe('updateByAdmin', () => {
        it('passes scope(update, Role) as additionalWhere, forwards the body and wraps the result', async () => {
            const body = { name: 'Editor', description: 'Edits' };
            const updated = { ...roleRow, ...body, policies: [] };
            roleDomain.updateByAdmin.mockResolvedValue(updated);

            await expect(
                service.updateByAdmin('role-id', body)
            ).resolves.toEqual({ data: updated });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.Role
            );
            expect(roleDomain.getOne).not.toHaveBeenCalled();
            expect(roleDomain.updateByAdmin).toHaveBeenCalledWith(
                'role-id',
                body,
                scopeWhere
            );
        });

        it('propagates PolicyForbiddenException from scope and never calls the domain', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.updateByAdmin('role-id', { name: 'Editor' })
            ).rejects.toThrow(PolicyForbiddenException);
            expect(roleDomain.updateByAdmin).not.toHaveBeenCalled();
        });
    });

    describe('createByAdmin', () => {
        const body = {
            scope: EnumRoleScope.workspace,
            key: 'workspace.editor',
            name: 'Workspace Editor',
        };

        it('forwards the body to the domain and wraps the created role', async () => {
            const created = {
                ...roleRow,
                scope: EnumRoleScope.workspace,
                key: 'workspace.editor',
                name: 'Workspace Editor',
                policies: [],
            };
            roleDomain.createByAdmin.mockResolvedValue(created);

            await expect(service.createByAdmin(body)).resolves.toEqual({
                data: created,
            });
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
            expect(roleDomain.createByAdmin).toHaveBeenCalledWith(body);
        });

        it('propagates a domain rejection unchanged', async () => {
            const error = new Error('domain');
            roleDomain.createByAdmin.mockRejectedValue(error);

            await expect(service.createByAdmin(body)).rejects.toBe(error);
        });
    });

    describe('deleteByAdmin', () => {
        it('passes scope(delete, Role) as additionalWhere and answers an empty envelope', async () => {
            roleDomain.deleteByAdmin.mockResolvedValue(undefined);

            await expect(service.deleteByAdmin('role-id')).resolves.toEqual({});
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.delete,
                EnumPolicySubject.Role
            );
            expect(roleDomain.getOne).not.toHaveBeenCalled();
            expect(roleDomain.deleteByAdmin).toHaveBeenCalledWith(
                'role-id',
                scopeWhere
            );
        });

        it('propagates a domain rejection unchanged', async () => {
            const error = new Error('domain');
            roleDomain.deleteByAdmin.mockRejectedValue(error);

            await expect(service.deleteByAdmin('role-id')).rejects.toBe(error);
        });

        it('propagates PolicyForbiddenException from scope and never calls the domain', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(service.deleteByAdmin('role-id')).rejects.toThrow(
                PolicyForbiddenException
            );
            expect(roleDomain.deleteByAdmin).not.toHaveBeenCalled();
        });
    });
});
