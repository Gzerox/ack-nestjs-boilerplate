import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { subject } from '@casl/ability';

import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import {
    EnumPolicyAction,
    EnumPolicySubject,
} from '@generated/prisma-client/client';
import type { Workspace } from '@generated/prisma-client/client';
import { PolicyForbiddenException } from '@modules/policy/exceptions/policy.forbidden.exception';
import { PolicyAbilityStoreKey } from '@modules/policy/constants/policy.constant';
import { PolicyAbilityDomain } from '@modules/policy/domains/policy.ability.domain';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';
import type { WorkspaceAdminListRequestDto } from '@modules/workspace/dtos/request/workspace.admin-list.request.dto';
import type { WorkspaceCreateRequestDto } from '@modules/workspace/dtos/request/workspace.create.request.dto';
import type { WorkspaceSwitchRequestDto } from '@modules/workspace/dtos/request/workspace.switch.request.dto';
import type { WorkspaceUpdateIsPublicRequestDto } from '@modules/workspace/dtos/request/workspace.update-is-public.request.dto';
import type { WorkspaceUpdateSlugRequestDto } from '@modules/workspace/dtos/request/workspace.update-slug.request.dto';
import type { WorkspaceUpdateRequestDto } from '@modules/workspace/dtos/request/workspace.update.request.dto';
import type { WorkspaceUserListRequestDto } from '@modules/workspace/dtos/request/workspace.user-list.request.dto';
import { WorkspaceDomain } from '@modules/workspace/domains/workspace.domain';
import { WorkspaceHttpService } from '@modules/workspace/services/workspace.http.service';

describe('WorkspaceHttpService', () => {
    const workspaceDomain: MockProxy<WorkspaceDomain> = mock<WorkspaceDomain>();
    const policyAbilityDomain: MockProxy<PolicyAbilityDomain> =
        mock<PolicyAbilityDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const workspace = {
        id: 'workspace-id',
        name: 'Acme',
        slug: 'acme',
        description: null,
        isPublic: false,
        createdAt: now,
        createdBy: 'user-id',
        updatedAt: now,
        updatedBy: 'user-id',
        deletedAt: null,
        deletedBy: null,
    } satisfies Workspace;
    const cursorPage = {
        type: EnumPaginationType.cursor as const,
        count: 1,
        perPage: 20,
        hasNext: false,
        cursor: undefined,
        data: [workspace],
    };
    const offsetPage = {
        type: EnumPaginationType.offset as const,
        count: 1,
        perPage: 20,
        page: 1,
        totalPage: 1,
        hasNext: false,
        hasPrevious: false,
        data: [workspace],
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
        availableSearch: ['slug', 'name'],
        availableOrderBy: ['createdAt'],
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
        availableSearch: ['slug', 'name'],
        availableOrderBy: ['createdAt', 'name'],
    };

    const accessibleWorkspaceWhere = { isPublic: true };

    let service: WorkspaceHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkspaceHttpService,
                { provide: WorkspaceDomain, useValue: workspaceDomain },
                { provide: PolicyAbilityDomain, useValue: policyAbilityDomain },
                {
                    provide: PaginationQueryUtil,
                    useValue: paginationQueryUtil,
                },
                {
                    provide: RequestStoreService,
                    useValue: requestStoreService,
                },
            ],
        }).compile();

        service = module.get(WorkspaceHttpService);
    });

    describe('getListForMember', () => {
        it('merges the store patch and wraps the domain page', async () => {
            const query = {} satisfies WorkspaceUserListRequestDto;
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            workspaceDomain.getListForMember.mockResolvedValue(cursorPage);

            const result = await service.getListForMember('user-id', query);

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                cursorStorePatch
            );
            expect(workspaceDomain.getListForMember).toHaveBeenCalledWith(
                'user-id',
                cursorParams
            );
            expect(result).toEqual(cursorPage);
        });
    });

    describe('createWorkspace', () => {
        it('delegates to the domain and wraps the created workspace', async () => {
            const dto = {
                name: 'Acme',
                description: 'Our team workspace',
                isPublic: true,
            } satisfies WorkspaceCreateRequestDto;
            workspaceDomain.createWorkspace.mockResolvedValue(workspace);

            const result = await service.createWorkspace('user-id', dto);

            expect(result).toEqual({ data: workspace });
            expect(workspaceDomain.createWorkspace).toHaveBeenCalledWith(
                'user-id',
                {
                    name: dto.name,
                    description: dto.description,
                    isPublic: dto.isPublic,
                }
            );
        });
    });

    describe('getCurrentWorkspace', () => {
        it('passes scope(read, Workspace) as additionalWhere and wraps the re-read workspace', async () => {
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);
            workspaceDomain.getCurrentWorkspace.mockResolvedValue(workspace);

            const result = await service.getCurrentWorkspace(workspace);

            expect(result).toEqual({ data: workspace });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.Workspace
            );
            expect(workspaceDomain.getCurrentWorkspace).toHaveBeenCalledWith(
                'workspace-id',
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
        });

        it('rethrows PolicyForbiddenException and skips the domain when the ability holds no read rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.getCurrentWorkspace(workspace)
            ).rejects.toThrow(PolicyForbiddenException);
            expect(workspaceDomain.getCurrentWorkspace).not.toHaveBeenCalled();
        });
    });

    describe('updateWorkspace', () => {
        it('passes scope(update, Workspace) as additionalWhere and wraps the updated workspace', async () => {
            const dto = {
                name: 'Acme Renamed',
                description: 'Updated description',
            } satisfies WorkspaceUpdateRequestDto;
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);
            workspaceDomain.updateWorkspace.mockResolvedValue(workspace);

            const result = await service.updateWorkspace(
                workspace,
                'actor-id',
                dto
            );

            expect(result).toEqual({ data: workspace });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.Workspace
            );
            expect(workspaceDomain.updateWorkspace).toHaveBeenCalledWith(
                'workspace-id',
                'actor-id',
                { name: dto.name, description: dto.description },
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
        });
    });

    describe('updateWorkspaceIsPublic', () => {
        it('passes scope(update, Workspace) as additionalWhere and wraps the updated workspace', async () => {
            const dto = {
                isPublic: true,
            } satisfies WorkspaceUpdateIsPublicRequestDto;
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);
            workspaceDomain.updateWorkspaceIsPublic.mockResolvedValue(
                workspace
            );

            const result = await service.updateWorkspaceIsPublic(
                workspace,
                'actor-id',
                dto
            );

            expect(result).toEqual({ data: workspace });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.Workspace
            );
            expect(
                workspaceDomain.updateWorkspaceIsPublic
            ).toHaveBeenCalledWith(
                'workspace-id',
                'actor-id',
                true,
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
        });
    });

    describe('updateWorkspaceSlug', () => {
        it('passes scope(update, Workspace) as additionalWhere and wraps the updated workspace', async () => {
            const dto = {
                slug: 'acme-team',
            } satisfies WorkspaceUpdateSlugRequestDto;
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);
            workspaceDomain.updateWorkspaceSlug.mockResolvedValue(workspace);

            const result = await service.updateWorkspaceSlug(
                workspace,
                'actor-id',
                dto
            );

            expect(result).toEqual({ data: workspace });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.Workspace
            );
            expect(workspaceDomain.updateWorkspaceSlug).toHaveBeenCalledWith(
                'workspace-id',
                'actor-id',
                'acme-team',
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
        });
    });

    describe('switchWorkspace', () => {
        it('delegates to the domain', async () => {
            const dto = {
                workspaceId: 'workspace-id',
            } satisfies WorkspaceSwitchRequestDto;

            await service.switchWorkspace('user-id', dto);

            expect(workspaceDomain.switchWorkspace).toHaveBeenCalledWith(
                'user-id',
                'workspace-id'
            );
        });
    });

    describe('softDeleteWorkspace', () => {
        it('passes scope(delete, Workspace) as additionalWhere', async () => {
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);

            await service.softDeleteWorkspace(workspace, 'actor-id');

            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.delete,
                EnumPolicySubject.Workspace
            );
            expect(workspaceDomain.softDeleteWorkspace).toHaveBeenCalledWith(
                'workspace-id',
                'actor-id',
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
        });
    });

    describe('getListForAdmin', () => {
        it('merges the isPublic filter into the store patch when provided', async () => {
            const query = {
                isPublic: true,
            } satisfies WorkspaceAdminListRequestDto;
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue({
                where: { isPublic: { equals: true } },
                storeFilter: { isPublic: true },
            } as never);
            workspaceDomain.getListForAdmin.mockResolvedValue(offsetPage);
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);

            const result = await service.getListForAdmin(query);

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...offsetStorePatch,
                    filters: { isPublic: true },
                }
            );
            expect(workspaceDomain.getListForAdmin).toHaveBeenCalledWith(
                offsetParams,
                { isPublic: { equals: true } },
                accessibleWorkspaceWhere
            );
            expect(result).toEqual(offsetPage);
        });

        it('merges an empty filter set when isPublic is not provided', async () => {
            const query = {} satisfies WorkspaceAdminListRequestDto;
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue(undefined);
            workspaceDomain.getListForAdmin.mockResolvedValue(offsetPage);
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);

            await service.getListForAdmin(query);

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...offsetStorePatch,
                    filters: {},
                }
            );
            expect(workspaceDomain.getListForAdmin).toHaveBeenCalledWith(
                offsetParams,
                undefined,
                accessibleWorkspaceWhere
            );
        });

        it('asks the policy domain for the read predicate of the stored ability', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue(undefined);
            workspaceDomain.getListForAdmin.mockResolvedValue(offsetPage);
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);

            await service.getListForAdmin({});

            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.Workspace
            );
        });

        it('throws RequestContextMissingException when no ability is stored and never lists', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(service.getListForAdmin({})).rejects.toThrow(
                RequestContextMissingException
            );
            expect(workspaceDomain.getListForAdmin).not.toHaveBeenCalled();
        });

        it('propagates the policy rejection when the ability holds no read rule and never lists', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue(undefined);
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(service.getListForAdmin({})).rejects.toThrow(
                PolicyForbiddenException
            );
            expect(workspaceDomain.getListForAdmin).not.toHaveBeenCalled();
        });
    });

    describe('getForAdmin', () => {
        it('passes scope(read, Workspace) as additionalWhere and wraps the workspace', async () => {
            policyAbilityDomain.scope.mockReturnValue(accessibleWorkspaceWhere);
            workspaceDomain.getByIdForAdmin.mockResolvedValue(workspace);

            const result = await service.getForAdmin(workspace.id);

            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.Workspace
            );
            expect(workspaceDomain.getByIdForAdmin).toHaveBeenCalledWith(
                workspace.id,
                accessibleWorkspaceWhere
            );
            expect(policyAbilityDomain.authorize).not.toHaveBeenCalled();
            expect(result).toEqual({ data: workspace });
        });

        it('throws PolicyForbiddenException and never reads when the ability holds no read rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(service.getForAdmin(workspace.id)).rejects.toThrow(
                PolicyForbiddenException
            );
            expect(workspaceDomain.getByIdForAdmin).not.toHaveBeenCalled();
        });

        it('throws RequestContextMissingException and never reads when no ability is stored', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(service.getForAdmin(workspace.id)).rejects.toThrow(
                RequestContextMissingException
            );
            expect(workspaceDomain.getByIdForAdmin).not.toHaveBeenCalled();
        });
    });

    describe('previewWorkspace', () => {
        it('delegates to the domain and wraps the workspace', async () => {
            workspaceDomain.previewWorkspace.mockResolvedValue(workspace);

            const result = await service.previewWorkspace('acme');

            expect(result).toEqual({ data: workspace });
            expect(workspaceDomain.previewWorkspace).toHaveBeenCalledWith(
                'acme'
            );
        });
    });

    describe('getEffectivePermissions', () => {
        it('wraps the permissions the policy ability domain reports', () => {
            const permissions = [
                { subject: 'Workspace', actions: ['read'] },
            ] as never;
            policyAbilityDomain.getEffectivePermissions.mockReturnValue(
                permissions
            );

            const result = service.getEffectivePermissions(workspace);

            expect(
                policyAbilityDomain.getEffectivePermissions
            ).toHaveBeenCalledWith([
                subject(EnumPolicySubject.Workspace, workspace),
            ]);
            expect(result).toEqual({ data: { permissions } });
        });

        it('throws when the ability is absent from the store', () => {
            policyAbilityDomain.getEffectivePermissions.mockImplementation(
                () => {
                    throw new RequestContextMissingException(
                        PolicyAbilityStoreKey
                    );
                }
            );

            expect(() => service.getEffectivePermissions(workspace)).toThrow(
                RequestContextMissingException
            );
        });
    });
});
