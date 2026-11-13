import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { EnumFileExtensionDocument } from '@common/file/enums/file.enum';
import { FileService } from '@common/file/services/file.service';
import { PaginationQueryUtil } from '@common/pagination/utils/pagination.query.util';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import {
    EnumStorageVisibility,
    EnumUserGender,
    EnumUserSignUpFrom,
    EnumUserSignUpWith,
    EnumUserStatus,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { IUserExport } from '@modules/user/interfaces/user.interface';
import { UserImportDomain } from '@modules/user/domains/user.import.domain';
import { UserOnboardingDomain } from '@modules/user/domains/user.onboarding.domain';
import { UserImportHttpService } from '@modules/user/services/user.import.http.service';
import { WorkspaceDomain } from '@modules/workspace/domains/workspace.domain';

describe('UserImportHttpService', () => {
    const userImportDomain: MockProxy<UserImportDomain> =
        mock<UserImportDomain>();
    const userOnboardingDomain: MockProxy<UserOnboardingDomain> =
        mock<UserOnboardingDomain>();
    const workspaceDomain: MockProxy<WorkspaceDomain> = mock<WorkspaceDomain>();
    const fileService: MockProxy<FileService> = mock<FileService>();
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
    const exportUser: IUserExport = {
        id: 'user-id',
        name: 'User',
        username: 'user',
        isVerified: true,
        verifiedAt: now,
        email: 'user@example.com',
        roleId: 'role-id',
        password: 'hash',
        passwordExpired: null,
        passwordCreated: now,
        passwordAttempt: 0,
        signUpAt: now,
        signUpFrom: EnumUserSignUpFrom.website,
        signUpWith: EnumUserSignUpWith.credential,
        status: EnumUserStatus.active,
        gender: EnumUserGender.male,
        countryId: 'country-id',
        lastLoginAt: null,
        lastIPAddress: null,
        lastLoginFrom: null,
        lastLoginWith: null,
        lastWorkspaceId: null,
        lastWorkspaceChangedAt: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
        termsOfServiceAccepted: true,
        privacyAccepted: true,
        cookiesAccepted: false,
        marketingAccepted: false,
        role: { name: 'User' },
        photo: userPhoto,
    };

    let service: UserImportHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        objectStorageService.toAssetResponse.mockImplementation(asset => {
            if (asset === userPhoto) {
                return photoResponse;
            }

            return null;
        });
        fileService.writeCsv.mockReturnValue('csv');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserImportHttpService,
                { provide: UserImportDomain, useValue: userImportDomain },
                {
                    provide: UserOnboardingDomain,
                    useValue: userOnboardingDomain,
                },
                { provide: WorkspaceDomain, useValue: workspaceDomain },
                { provide: FileService, useValue: fileService },
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

        service = module.get(UserImportHttpService);
    });

    describe('exportByAdmin', () => {
        it('exports the resolved public photo url and a null photo for a user without one', async () => {
            userImportDomain.exportByAdmin.mockResolvedValue([
                exportUser,
                { ...exportUser, id: 'user-2', photo: null },
            ]);

            const result = await service.exportByAdmin({});

            expect(objectStorageService.toAssetResponse).toHaveBeenCalledWith(
                userPhoto
            );
            expect(fileService.writeCsv).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: 'user-id',
                    photo: photoResponse.url,
                }),
                expect.objectContaining({ id: 'user-2', photo: null }),
            ]);
            expect(result).toEqual({
                data: 'csv',
                extension: EnumFileExtensionDocument.csv,
            });
        });
    });
});
