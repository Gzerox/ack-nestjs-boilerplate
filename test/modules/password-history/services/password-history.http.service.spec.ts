import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import {
    EnumPasswordHistoryType,
    EnumStorageVisibility,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { IPasswordHistoryList } from '@modules/password-history/interfaces/password-history.interface';
import { PasswordHistoryDomain } from '@modules/password-history/domains/password-history.domain';
import { PasswordHistoryHttpService } from '@modules/password-history/services/password-history.http.service';

describe('PasswordHistoryHttpService', () => {
    const passwordHistoryDomain: MockProxy<PasswordHistoryDomain> =
        mock<PasswordHistoryDomain>();
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
    const passwordHistory: IPasswordHistoryList = {
        id: 'password-history-id',
        userId: 'user-id',
        type: EnumPasswordHistoryType.admin,
        expiredAt: now,
        createdAt: now,
        createdBy: null,
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

    let service: PasswordHistoryHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PasswordHistoryHttpService,
                {
                    provide: PasswordHistoryDomain,
                    useValue: passwordHistoryDomain,
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

        service = module.get(PasswordHistoryHttpService);
    });

    describe('getListOffsetByAdmin', () => {
        it('returns the domain entries unchanged', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: { limit: 20, skip: 0, orderBy: [] },
                storePatch: { page: 1, perPage: 20 },
            } as never);
            passwordHistoryDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [passwordHistory],
            });

            const result = await service.getListOffsetByAdmin('user-id', {});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { page: 1, perPage: 20 }
            );
            expect(result.data).toEqual([passwordHistory]);
        });
    });

    describe('getListCursor', () => {
        it('returns the domain entries unchanged', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: { limit: 20, orderBy: [] },
                storePatch: { perPage: 20 },
            } as never);
            passwordHistoryDomain.getListCursor.mockResolvedValue({
                type: EnumPaginationType.cursor,
                perPage: 20,
                hasNext: false,
                data: [passwordHistory],
            });

            const result = await service.getListCursor('user-id', {});

            expect(passwordHistoryDomain.getListCursor).toHaveBeenCalledWith(
                'user-id',
                { limit: 20, orderBy: [] }
            );
            expect(result.data).toEqual([passwordHistory]);
        });
    });
});
