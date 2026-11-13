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
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { ISessionList } from '@modules/session/interfaces/session.interface';
import { SessionDomain } from '@modules/session/domains/session.domain';
import { SessionHttpService } from '@modules/session/services/session.http.service';
import type { IUserRef } from '@modules/user/interfaces/user.interface';

describe('SessionHttpService', () => {
    const sessionDomain: MockProxy<SessionDomain> = mock<SessionDomain>();
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
    const userRef: IUserRef = {
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
    };
    const adminRef: IUserRef = {
        ...userRef,
        id: 'admin-id',
        username: 'admin',
        photo: userPhoto,
    };
    const session: ISessionList = {
        id: 'session-id',
        userId: 'user-id',
        deviceOwnershipId: 'device-ownership-id',
        ipAddress: '127.0.0.1',
        userAgent: {},
        geoLocation: null,
        expiredAt: now,
        revokedAt: now,
        isRevoked: true,
        revokedById: 'admin-id',
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        user: userRef,
        revokedBy: adminRef,
    };
    const mappedSession = {
        ...session,
        user: { ...userRef, photo: photoResponse },
        revokedBy: { ...adminRef, photo: null },
    };

    let service: SessionHttpService;

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
                SessionHttpService,
                { provide: SessionDomain, useValue: sessionDomain },
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

        service = module.get(SessionHttpService);
    });

    describe('getListOffsetByAdmin', () => {
        it('resolves the owner and revoker photos of every session', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: { limit: 20, skip: 0, orderBy: [] },
                storePatch: { page: 1, perPage: 20 },
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue(undefined);
            sessionDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [session],
            });

            const result = await service.getListOffsetByAdmin('user-id', {});

            expect(requestStoreService.merge).toHaveBeenCalledWith(
                PaginationStoreKey,
                { page: 1, perPage: 20, filters: {} }
            );
            expect(objectStorageService.toAssetResponse).toHaveBeenCalledWith(
                userPhoto
            );
            expect(result.data).toEqual([mappedSession]);
        });
    });

    describe('getListCursor', () => {
        it('resolves the owner photo and keeps a null revoker', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: { limit: 20, orderBy: [] },
                storePatch: { perPage: 20 },
            } as never);
            sessionDomain.getListCursor.mockResolvedValue({
                type: EnumPaginationType.cursor,
                perPage: 20,
                hasNext: false,
                data: [{ ...session, revokedBy: null, revokedById: null }],
            });

            const result = await service.getListCursor('user-id', {});

            expect(result.data).toEqual([
                {
                    ...mappedSession,
                    revokedBy: null,
                    revokedById: null,
                },
            ]);
        });
    });

    describe('mapSession', () => {
        it('resolves the owner photo and drops the revoker photo', () => {
            const result = service['mapSession'](session);

            expect(result).toEqual(mappedSession);
        });

        it('keeps a null revoker without resolving a photo for it', () => {
            const result = service['mapSession']({
                ...session,
                revokedBy: null,
            });

            expect(result.revokedBy).toBeNull();
            expect(objectStorageService.toAssetResponse).toHaveBeenCalledTimes(
                1
            );
        });
    });
});
