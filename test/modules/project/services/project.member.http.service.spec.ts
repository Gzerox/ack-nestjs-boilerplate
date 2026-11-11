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
    EnumProjectMemberRole,
    EnumStorageVisibility,
    EnumWorkspaceMemberRole,
} from '@generated/prisma-client/client';
import type {
    Project,
    UserPhoto,
    WorkspaceMember,
} from '@generated/prisma-client/client';
import type { IProjectMember } from '@modules/project/interfaces/project.interface';
import { ProjectMemberDomain } from '@modules/project/domains/project.member.domain';
import { ProjectMemberHttpService } from '@modules/project/services/project.member.http.service';
import { WorkspaceMemberDomain } from '@modules/workspace/domains/workspace.member.domain';

describe('ProjectMemberHttpService', () => {
    const projectMemberDomain: MockProxy<ProjectMemberDomain> =
        mock<ProjectMemberDomain>();
    const workspaceMemberDomain: MockProxy<WorkspaceMemberDomain> =
        mock<WorkspaceMemberDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
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
    const project: Project = {
        id: 'project-id',
        workspaceId: 'workspace-id',
        name: 'Project',
        slug: 'project',
        description: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
    };
    const member: IProjectMember = {
        id: 'project-member-id',
        projectId: 'project-id',
        userId: 'user-id',
        role: EnumProjectMemberRole.member,
        joinedAt: now,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        user: {
            id: 'user-id',
            name: 'User',
            username: 'user',
            photo: userPhoto,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
            deletedAt: null,
            deletedBy: null,
        },
    };
    const mappedMember = {
        ...member,
        user: { ...member.user, photo: photoResponse },
    };

    let service: ProjectMemberHttpService;

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
                ProjectMemberHttpService,
                { provide: ProjectMemberDomain, useValue: projectMemberDomain },
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
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
            ],
        }).compile();

        service = module.get(ProjectMemberHttpService);
    });

    describe('getMembersList', () => {
        it('resolves the photo of every member user', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: { limit: 20, orderBy: [] },
                storePatch: { perPage: 20 },
            } as never);
            projectMemberDomain.getMembersList.mockResolvedValue({
                type: EnumPaginationType.cursor,
                perPage: 20,
                hasNext: false,
                data: [member],
            });

            const result = await service.getMembersList(project, {});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { perPage: 20 }
            );
            expect(objectStorageService.toAssetResponse).toHaveBeenCalledWith(
                userPhoto
            );
            expect(result.data).toEqual([mappedMember]);
        });
    });

    describe('assignMember', () => {
        it('resolves the photo of the assigned member user', async () => {
            const targetMember: WorkspaceMember = {
                id: 'workspace-member-id',
                workspaceId: 'workspace-id',
                userId: 'user-id',
                role: EnumWorkspaceMemberRole.member,
                joinedAt: now,
                createdAt: now,
                createdBy: null,
                updatedAt: now,
                updatedBy: null,
            };
            workspaceMemberDomain.getOneByWorkspaceAndUser.mockResolvedValue(
                targetMember
            );
            projectMemberDomain.assignMember.mockResolvedValue(member);

            const result = await service.assignMember(project, 'actor-id', {
                userId: 'user-id',
                role: EnumProjectMemberRole.member,
            });

            expect(projectMemberDomain.assignMember).toHaveBeenCalledWith(
                project,
                'actor-id',
                targetMember,
                EnumProjectMemberRole.member
            );
            expect(result).toEqual({ data: mappedMember });
        });
    });

    describe('mapMember', () => {
        it('resolves the member user photo', () => {
            const result = service['mapMember'](member);

            expect(result).toEqual(mappedMember);
        });
    });
});
