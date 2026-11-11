import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { StorageAssetResponseDto } from '@common/storage/dtos/response/storage.asset.response.dto';
import type {
    IStorageSignedUpload,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import {
    EnumRoleType,
    EnumStorageVisibility,
    EnumUserGender,
    EnumUserSignUpFrom,
    EnumUserSignUpWith,
    EnumUserStatus,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import type { IUserProfile } from '@modules/user/interfaces/user.interface';
import { UserProfileDomain } from '@modules/user/domains/user.profile.domain';
import { UserProfileHttpService } from '@modules/user/services/user.profile.http.service';

describe('UserProfileHttpService', () => {
    const userProfileDomain: MockProxy<UserProfileDomain> =
        mock<UserProfileDomain>();
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
        etag: '"etag"',
    };
    const photoResponse: StorageAssetResponseDto = {
        key: 'users/user-id/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        url: 'https://cdn.example.com/users/user-id/profile/photo.png',
    };
    const userProfile: IUserProfile = {
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
        role: {
            id: 'role-id',
            name: 'User',
            description: null,
            type: EnumRoleType.user,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
            policies: [],
        },
        twoFactor: null,
        mobileNumbers: [],
        country: {
            id: 'country-id',
            name: 'Country',
            alpha2Code: 'CC',
            alpha3Code: 'CCC',
            continent: 'Continent',
            timezone: 'UTC',
            phoneCodes: ['+1'],
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
        },
        photo: userPhoto,
    };

    let service: UserProfileHttpService;

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
                UserProfileHttpService,
                { provide: UserProfileDomain, useValue: userProfileDomain },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
            ],
        }).compile();

        service = module.get(UserProfileHttpService);
    });

    describe('getProfile', () => {
        it('resolves the profile photo through toAssetResponse', async () => {
            userProfileDomain.getProfile.mockResolvedValue(userProfile);

            const result = await service.getProfile('user-id');

            expect(userProfileDomain.getProfile).toHaveBeenCalledWith(
                'user-id'
            );
            expect(result).toEqual({
                data: { ...userProfile, photo: photoResponse },
            });
        });

        it('returns a null photo when the user has none', async () => {
            userProfileDomain.getProfile.mockResolvedValue({
                ...userProfile,
                photo: null,
            });

            const result = await service.getProfile('user-id');

            expect(result.data?.photo).toBeNull();
        });
    });

    describe('generatePhotoProfilePresign', () => {
        it('returns the signed upload the domain issued', async () => {
            const signedUpload: IStorageSignedUpload = {
                key: 'incoming/users/user-id/profile/photo.png',
                url: 'https://storage.example.com/upload?signature=abc',
                method: 'PUT',
                headers: { 'content-type': 'image/png' },
                expiresAt: now,
            };
            userProfileDomain.generatePhotoProfilePresign.mockResolvedValue(
                signedUpload
            );

            const result = await service.generatePhotoProfilePresign(
                'user-id',
                { extension: EnumFileExtensionImage.png, size: 100 }
            );

            expect(
                userProfileDomain.generatePhotoProfilePresign
            ).toHaveBeenCalledWith('user-id', {
                extension: EnumFileExtensionImage.png,
                size: 100,
            });
            expect(result).toEqual({ data: signedUpload });
        });
    });

    describe('updatePhotoProfile', () => {
        it('hands the staging key alone to the domain', async () => {
            await service.updatePhotoProfile('user-id', {
                key: 'incoming/users/user-id/profile/photo.png',
            });

            expect(userProfileDomain.updatePhotoProfile).toHaveBeenCalledWith(
                'user-id',
                { key: 'incoming/users/user-id/profile/photo.png' }
            );
        });
    });

    describe('uploadPhotoProfile', () => {
        it('hands the stored asset to the domain', async () => {
            const stored: IStoredAsset = {
                key: 'users/user-id/profile/photo.png',
                visibility: EnumStorageVisibility.public,
                contentType: 'image/png',
                size: 100,
                etag: null,
            };

            await service.uploadPhotoProfile('user-id', stored);

            expect(userProfileDomain.uploadPhotoProfile).toHaveBeenCalledWith(
                'user-id',
                stored
            );
        });
    });

    describe('updateProfile', () => {
        it('delegates the profile fields to the domain', async () => {
            await service.updateProfile('user-id', {
                countryId: 'country-id',
                gender: EnumUserGender.female,
                name: 'User',
            });

            expect(userProfileDomain.updateProfile).toHaveBeenCalledWith(
                'user-id',
                {
                    countryId: 'country-id',
                    gender: EnumUserGender.female,
                    name: 'User',
                }
            );
        });
    });

    describe('claimUsername', () => {
        it('delegates the username to the domain', async () => {
            await service.claimUsername('user-id', { username: 'newname' });

            expect(userProfileDomain.claimUsername).toHaveBeenCalledWith(
                'user-id',
                'newname'
            );
        });
    });
});
