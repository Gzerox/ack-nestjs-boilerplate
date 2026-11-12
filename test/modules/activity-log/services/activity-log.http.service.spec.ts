import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { IActivityLog } from '@modules/activity-log/interfaces/activity-log.interface';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import { ActivityLogHttpService } from '@modules/activity-log/services/activity-log.http.service';

describe('ActivityLogHttpService', () => {
    const activityLogDomain: MockProxy<ActivityLogDomain> =
        mock<ActivityLogDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
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
    const activityLog: IActivityLog = {
        id: 'activity-log-id',
        userId: 'user-id',
        workspaceId: null,
        action: EnumActivityLogAction.userLoginCredential,
        ipAddress: '127.0.0.1',
        userAgent: {},
        description: 'User login with credential',
        geoLocation: null,
        metadata: null,
        createdAt: now,
        createdBy: 'user-id',
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
    const offsetPage = {
        type: EnumPaginationType.offset as const,
        count: 1,
        perPage: 20,
        page: 1,
        totalPage: 1,
        hasNext: false,
        hasPrevious: false,
        data: [activityLog],
    };
    const cursorPage = {
        type: EnumPaginationType.cursor as const,
        perPage: 20,
        hasNext: false,
        data: [activityLog],
    };
    const offsetPagination = {
        params: { limit: 20, skip: 0, orderBy: [] },
        storePatch: { page: 1, perPage: 20 },
    };
    const cursorPagination = {
        params: { limit: 20, orderBy: [] },
        storePatch: { perPage: 20 },
    };

    let service: ActivityLogHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        paginationQueryUtil.offset.mockReturnValue(offsetPagination as never);
        paginationQueryUtil.cursor.mockReturnValue(cursorPagination as never);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ActivityLogHttpService,
                { provide: ActivityLogDomain, useValue: activityLogDomain },
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

        service = module.get(ActivityLogHttpService);
    });

    describe('getListOffsetByUser', () => {
        it('returns the domain entries unchanged', async () => {
            activityLogDomain.getListOffsetByUser.mockResolvedValue(offsetPage);

            const result = await service.getListOffsetByUser('user-id', {});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                offsetPagination.storePatch
            );
            expect(result.data).toEqual([activityLog]);
        });
    });

    describe('getListCursorByUser', () => {
        it('returns the domain entries unchanged', async () => {
            activityLogDomain.getListCursorByUser.mockResolvedValue(cursorPage);

            const result = await service.getListCursorByUser('user-id', {});

            expect(result.data).toEqual([activityLog]);
        });
    });

    describe('getListOffsetByWorkspace', () => {
        it('returns the domain entries unchanged', async () => {
            activityLogDomain.getListOffsetByWorkspace.mockResolvedValue(
                offsetPage
            );

            const result = await service.getListOffsetByWorkspace(
                'workspace-id',
                null,
                {}
            );

            expect(
                activityLogDomain.getListOffsetByWorkspace
            ).toHaveBeenCalledWith(
                'workspace-id',
                null,
                offsetPagination.params
            );
            expect(result.data).toEqual([activityLog]);
        });
    });

    describe('getListCursorByWorkspace', () => {
        it('returns the domain entries unchanged', async () => {
            activityLogDomain.getListCursorByWorkspace.mockResolvedValue(
                cursorPage
            );

            const result = await service.getListCursorByWorkspace(
                'workspace-id',
                'user-id',
                {}
            );

            expect(
                activityLogDomain.getListCursorByWorkspace
            ).toHaveBeenCalledWith(
                'workspace-id',
                'user-id',
                cursorPagination.params
            );
            expect(result.data).toEqual([activityLog]);
        });
    });
});
