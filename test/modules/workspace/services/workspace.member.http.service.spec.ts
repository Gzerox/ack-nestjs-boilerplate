import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import {
    EnumStorageVisibility,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import type {
    UserPhoto,
    WorkspaceMember,
} from '@generated/prisma-client/client';
import type { WorkspaceAdminMemberListRequestDto } from '@modules/workspace/dtos/request/workspace.admin-member-list.request.dto';
import type { WorkspaceMemberListRequestDto } from '@modules/workspace/dtos/request/workspace.member-list.request.dto';
import type { WorkspaceMemberUpdateRoleRequestDto } from '@modules/workspace/dtos/request/workspace.member-update-role.request.dto';
import type { WorkspaceTransferOwnershipRequestDto } from '@modules/workspace/dtos/request/workspace.transfer-ownership.request.dto';
import type { IWorkspaceMember } from '@modules/workspace/interfaces/workspace.interface';
import { WorkspaceMemberDomain } from '@modules/workspace/domains/workspace.member.domain';
import { WorkspaceMemberHttpService } from '@modules/workspace/services/workspace.member.http.service';

describe('WorkspaceMemberHttpService', () => {
    const workspaceMemberDomain: MockProxy<WorkspaceMemberDomain> =
        mock<WorkspaceMemberDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const actorMember = {
        id: 'member-id',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        role: EnumWorkspaceMemberRole.owner,
        joinedAt: now,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
    } satisfies WorkspaceMember;
    const memberListItem = {
        id: 'member-id',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        role: EnumWorkspaceMemberRole.member,
        joinedAt: now,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        user: {
            id: 'user-id',
            name: 'User',
            username: 'user',
            photo: null,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
            deletedAt: null,
            deletedBy: null,
        },
    } satisfies IWorkspaceMember;
    const cursorPage = {
        type: EnumPaginationType.cursor as const,
        count: 1,
        perPage: 20,
        hasNext: false,
        cursor: undefined,
        data: [memberListItem],
    };
    const offsetPage = {
        type: EnumPaginationType.offset as const,
        count: 1,
        perPage: 20,
        page: 1,
        totalPage: 1,
        hasNext: false,
        hasPrevious: false,
        data: [memberListItem],
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
        availableOrderBy: ['joinedAt'],
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
        availableOrderBy: ['joinedAt'],
    };

    const userPhoto: UserPhoto = {
        id: 'photo-id',
        userId: 'user-id',
        key: 'users/user-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: BigInt(1024),
        etag: null,
    };
    const photoResponse: StorageAssetResponseDto = {
        key: 'users/user-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        url: 'https://cdn.example.com/users/user-id/profile/photo.png',
    };
    const memberWithPhoto = {
        ...memberListItem,
        user: { ...memberListItem.user, photo: userPhoto },
    } satisfies IWorkspaceMember;
    const mappedMemberWithPhoto = {
        ...memberListItem,
        user: { ...memberListItem.user, photo: photoResponse },
    };

    let service: WorkspaceMemberHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        objectStorageService.toAssetResponse.mockImplementation(asset => {
            if (asset === userPhoto) {
                return photoResponse;
            }

            return null;
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkspaceMemberHttpService,
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
                {
                    provide: WorkspaceMemberDomain,
                    useValue: workspaceMemberDomain,
                },
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

        service = module.get(WorkspaceMemberHttpService);
    });

    describe('transferOwnership', () => {
        it('delegates to the domain with the target user id', async () => {
            const dto = {
                targetUserId: 'target-user-id',
            } satisfies WorkspaceTransferOwnershipRequestDto;

            await service.transferOwnership('workspace-id', actorMember, dto);

            expect(
                workspaceMemberDomain.transferOwnership
            ).toHaveBeenCalledWith(
                'workspace-id',
                actorMember,
                'target-user-id'
            );
        });
    });

    describe('leaveWorkspace', () => {
        it('delegates to the domain', async () => {
            await service.leaveWorkspace('workspace-id', actorMember);

            expect(workspaceMemberDomain.leaveWorkspace).toHaveBeenCalledWith(
                'workspace-id',
                actorMember
            );
        });
    });

    describe('getMembersList', () => {
        it('merges the role filter into the store patch when a role is provided', async () => {
            const query = {
                role: 'admin',
            } satisfies WorkspaceMemberListRequestDto;
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue({
                where: { role: { in: ['admin'] } },
                storeFilter: { role: ['admin'] },
            } as never);
            workspaceMemberDomain.getMembersList.mockResolvedValue(cursorPage);

            const result = await service.getMembersList('workspace-id', query);

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...cursorStorePatch,
                    filters: { role: ['admin'] },
                }
            );
            expect(workspaceMemberDomain.getMembersList).toHaveBeenCalledWith(
                'workspace-id',
                cursorParams,
                { role: { in: ['admin'] } }
            );
            expect(result).toEqual(cursorPage);
        });

        it('merges an empty filter set when no role is provided', async () => {
            const query = {} satisfies WorkspaceMemberListRequestDto;
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue(undefined);
            workspaceMemberDomain.getMembersList.mockResolvedValue(cursorPage);

            await service.getMembersList('workspace-id', query);

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                {
                    ...cursorStorePatch,
                    filters: {},
                }
            );
            expect(workspaceMemberDomain.getMembersList).toHaveBeenCalledWith(
                'workspace-id',
                cursorParams,
                undefined
            );
        });
        it('resolves the photo of every member user', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: cursorParams,
                storePatch: cursorStorePatch,
            } as never);
            paginationQueryUtil.inEnum.mockReturnValue(undefined);
            workspaceMemberDomain.getMembersList.mockResolvedValue({
                ...cursorPage,
                data: [memberWithPhoto],
            });

            const result = await service.getMembersList('workspace-id', {});

            expect(objectStorageService.toAssetResponse).toHaveBeenCalledWith(
                userPhoto
            );
            expect(result.data).toEqual([mappedMemberWithPhoto]);
        });
    });

    describe('updateMemberRole', () => {
        it('delegates to the domain with the new role', async () => {
            const dto = {
                role: EnumWorkspaceMemberRole.admin,
            } satisfies WorkspaceMemberUpdateRoleRequestDto;

            await service.updateMemberRole(
                'workspace-id',
                actorMember,
                'target-member-id',
                dto
            );

            expect(workspaceMemberDomain.updateMemberRole).toHaveBeenCalledWith(
                'workspace-id',
                actorMember,
                'target-member-id',
                EnumWorkspaceMemberRole.admin
            );
        });
    });

    describe('removeMember', () => {
        it('delegates to the domain', async () => {
            await service.removeMember(
                'workspace-id',
                actorMember,
                'target-member-id'
            );

            expect(workspaceMemberDomain.removeMember).toHaveBeenCalledWith(
                'workspace-id',
                actorMember,
                'target-member-id'
            );
        });
    });

    describe('getMembersListForAdmin', () => {
        it('merges the offset store patch and wraps the domain page', async () => {
            const query = {
                page: 1,
                perPage: 20,
            } satisfies WorkspaceAdminMemberListRequestDto;
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            workspaceMemberDomain.getMembersListForAdmin.mockResolvedValue(
                offsetPage
            );

            const result = await service.getMembersListForAdmin(
                'workspace-id',
                query
            );

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                offsetStorePatch
            );
            expect(
                workspaceMemberDomain.getMembersListForAdmin
            ).toHaveBeenCalledWith('workspace-id', offsetParams);
            expect(result).toEqual(offsetPage);
        });

        it('resolves the photo of every member user', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: offsetParams,
                storePatch: offsetStorePatch,
            } as never);
            workspaceMemberDomain.getMembersListForAdmin.mockResolvedValue({
                ...offsetPage,
                data: [memberWithPhoto],
            });

            const result = await service.getMembersListForAdmin(
                'workspace-id',
                { page: 1, perPage: 20 }
            );

            expect(result.data).toEqual([mappedMemberWithPhoto]);
        });
    });

    describe('mapMember', () => {
        it('resolves the member user photo', () => {
            const result = service['mapMember'](memberWithPhoto);

            expect(result).toEqual(mappedMemberWithPhoto);
        });
    });
});
