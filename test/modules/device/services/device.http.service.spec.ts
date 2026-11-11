import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import {
    EnumDevicePlatform,
    EnumStorageVisibility,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { IDeviceOwnership } from '@modules/device/interfaces/device.interface';
import { DeviceDomain } from '@modules/device/domains/device.domain';
import { DeviceHttpService } from '@modules/device/services/device.http.service';
import type { IUserRef } from '@modules/user/interfaces/user.interface';

describe('DeviceHttpService', () => {
    const deviceDomain: MockProxy<DeviceDomain> = mock<DeviceDomain>();
    const paginationQueryUtil: MockProxy<PaginationQueryUtil> =
        mock<PaginationQueryUtil>();
    const requestStoreService: MockProxy<RequestStoreService> =
        mock<RequestStoreService>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const adminPhoto: UserPhoto = {
        id: 'photo-id',
        userId: 'admin-id',
        key: 'users/admin-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: BigInt(1024),
        etag: null,
    };
    const photoResponse: StorageAssetResponseDto = {
        key: 'users/admin-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        url: 'https://cdn.example.com/users/admin-id/profile/photo.png',
    };
    const userRef: IUserRef = {
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
    };
    const adminRef: IUserRef = {
        ...userRef,
        id: 'admin-id',
        username: 'admin',
        photo: adminPhoto,
    };
    const ownership: IDeviceOwnership = {
        id: 'ownership-id',
        deviceId: 'device-id',
        userId: 'user-id',
        revokedAt: now,
        isRevoked: true,
        revokedById: 'admin-id',
        lastActiveAt: now,
        biometricEnabled: false,
        biometricToken: null,
        biometricType: null,
        biometricEnabledAt: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        device: {
            id: 'device-id',
            fingerprint: 'fingerprint',
            name: 'Phone',
            platform: EnumDevicePlatform.android,
            lastActiveAt: now,
            notificationToken: null,
            notificationProvider: null,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
        },
        user: userRef,
        revokedBy: adminRef,
        _count: { sessions: 2 },
    };

    let service: DeviceHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        objectStorageService.toAssetResponse.mockImplementation(asset => {
            if (asset === adminPhoto) {
                return photoResponse;
            }

            return null;
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceHttpService,
                { provide: DeviceDomain, useValue: deviceDomain },
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

        service = module.get(DeviceHttpService);
    });

    describe('getListOffsetByAdmin', () => {
        it('resolves the revoker photo of every device ownership', async () => {
            paginationQueryUtil.offset.mockReturnValue({
                params: { limit: 20, skip: 0, orderBy: [] },
                storePatch: { page: 1, perPage: 20 },
            } as never);
            paginationQueryUtil.equalBoolean.mockReturnValue(undefined);
            deviceDomain.getListOffsetByAdmin.mockResolvedValue({
                type: EnumPaginationType.offset,
                count: 1,
                perPage: 20,
                page: 1,
                totalPage: 1,
                hasNext: false,
                hasPrevious: false,
                data: [ownership],
            });

            const result = await service.getListOffsetByAdmin('user-id', {});

            expect(objectStorageService.toAssetResponse).toHaveBeenCalledWith(
                adminPhoto
            );
            expect(result.data).toEqual([
                {
                    ...ownership,
                    revokedBy: { ...adminRef, photo: photoResponse },
                    activeSessionCount: 2,
                    isCurrentDevice: false,
                },
            ]);
        });
    });

    describe('getListCursor', () => {
        it('keeps a null revoker and flags the current device', async () => {
            paginationQueryUtil.cursor.mockReturnValue({
                params: { limit: 20, orderBy: [] },
                storePatch: { perPage: 20 },
            } as never);
            deviceDomain.getListCursor.mockResolvedValue({
                type: EnumPaginationType.cursor,
                perPage: 20,
                hasNext: false,
                data: [
                    {
                        ...ownership,
                        revokedBy: null,
                        revokedById: null,
                        sessions: [{ id: 'session-id' }],
                    },
                ],
            });

            const result = await service.getListCursor(
                'user-id',
                'session-id',
                {}
            );

            expect(result.data).toEqual([
                expect.objectContaining({
                    revokedBy: null,
                    activeSessionCount: 2,
                    isCurrentDevice: true,
                }),
            ]);
            expect(objectStorageService.toAssetResponse).not.toHaveBeenCalled();
        });
    });

    describe('mapRevokedBy', () => {
        it('resolves the photo of a present revoker', () => {
            const result = service['mapRevokedBy'](adminRef);

            expect(result).toEqual({ ...adminRef, photo: photoResponse });
        });

        it('returns null for an absent revoker', () => {
            const result = service['mapRevokedBy'](null);

            expect(result).toBeNull();
        });
    });
});
