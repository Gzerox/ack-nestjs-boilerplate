import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import { StoragePromotionFailedException } from '@common/storage/exceptions/storage.promotion-failed.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';
import type {
    IStorageSignedUpload,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import type { IActivityLogStagedEvent } from '@modules/activity-log/interfaces/activity-log.interface';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
    EnumUserGender,
} from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import { CountryNotFoundException } from '@modules/country/exceptions/country.not-found.exception';
import { CountryDomain } from '@modules/country/domains/country.domain';
import { UserNotFoundException } from '@modules/user/exceptions/user.not-found.exception';
import { UserUsernameContainBadWordException } from '@modules/user/exceptions/user.username-contain-bad-word.exception';
import { UserUsernameExistException } from '@modules/user/exceptions/user.username-exist.exception';
import { UserUsernameNotAllowedException } from '@modules/user/exceptions/user.username-not-allowed.exception';
import { UserRepository } from '@modules/user/repositories/user.repository';
import { EnumUserStatusCodeError } from '@modules/user/enums/user.status-code.enum';
import { UserProfileDomain } from '@modules/user/domains/user.profile.domain';
import { UserUtil } from '@modules/user/utils/user.util';

describe('UserProfileDomain', () => {
    const userRepository: MockProxy<UserRepository> = mock<UserRepository>();
    const activityLogDomain: MockProxy<ActivityLogDomain> =
        mock<ActivityLogDomain>();
    const countryDomain: MockProxy<CountryDomain> = mock<CountryDomain>();
    const userUtil: MockProxy<UserUtil> = mock<UserUtil>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>();

    const userId = 'user-id';
    const scopePrefix = 'avatars/user-id/photo/';
    const maxSizeInBytes = 2048;
    const photoContentTypes = ['image/jpeg', 'image/png'];
    const preparedEvent: IActivityLogStagedEvent = {
        action: EnumActivityLogAction.userUpdatePhotoProfile,
        metadata: {},
        onError: false,
    };
    const stored: IStoredAsset = {
        key: 'users/user-id/profile/new-photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: 100,
        etag: '"new-etag"',
    };
    const previousPhoto: UserPhoto = {
        id: 'photo-id',
        userId,
        key: 'users/user-id/profile/old-photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: BigInt(50),
        etag: null,
    };
    const stagedKey = 'incoming/users/user-id/profile/staged-photo.png';
    const staged: IStoredAsset = {
        key: stagedKey,
        visibility: EnumStorageVisibility.private,
        contentType: 'image/png',
        size: 100,
        etag: '"staged-etag"',
    };
    const promoted: IStoredAsset = {
        key: 'users/user-id/profile/promoted-photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        size: 100,
        etag: '"promoted-etag"',
    };
    const signedUpload: IStorageSignedUpload = {
        key: stagedKey,
        url: 'https://storage.example.com/upload?signature=abc',
        method: 'PUT',
        headers: { 'content-type': 'image/png', 'content-length': '100' },
        expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    };

    let service: UserProfileDomain;

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values = {
                'user.photo.maxSizeInBytes': maxSizeInBytes,
                'user.photo.scopePrefixPattern': 'avatars/{userId}/photo/',
            };

            return values[key as keyof typeof values];
        });
        countryDomain.existsById.mockResolvedValue(true);
        userUtil.checkUsernamePattern.mockReturnValue(false);
        userUtil.checkBadWord.mockResolvedValue(false);
        userRepository.existsByUsername.mockResolvedValue(false);
        activityLogDomain.prepare.mockReturnValue(preparedEvent);
        userRepository.updatePhotoProfile.mockResolvedValue(previousPhoto);
        objectStorageService.createSignedUpload.mockResolvedValue(signedUpload);
        objectStorageService.verifyStaged.mockResolvedValue(staged);
        objectStorageService.promote.mockResolvedValue(promoted);
        objectStorageService.delete.mockResolvedValue();

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                UserProfileDomain,
                { provide: UserRepository, useValue: userRepository },
                { provide: ActivityLogDomain, useValue: activityLogDomain },
                { provide: CountryDomain, useValue: countryDomain },
                { provide: UserUtil, useValue: userUtil },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();
        service = moduleRef.get(UserProfileDomain);
    });

    describe('getProfile', () => {
        it('throws UserNotFoundException when no active profile exists', async () => {
            userRepository.findOneActiveProfileById.mockResolvedValue(null);

            await expect(service.getProfile('user-id')).rejects.toBeInstanceOf(
                UserNotFoundException
            );
        });
    });

    describe('updateProfile', () => {
        it('updates profile data after validating the country', async () => {
            await service.updateProfile('user-id', {
                countryId: 'country-id',
                gender: EnumUserGender.male,
                name: 'User',
            });

            expect(countryDomain.existsById).toHaveBeenCalledWith('country-id');
            expect(userRepository.updateProfile).toHaveBeenCalledWith(
                'user-id',
                {
                    countryId: 'country-id',
                    gender: EnumUserGender.male,
                    name: 'User',
                }
            );
        });

        it('throws CountryNotFoundException when the country id is unknown', async () => {
            countryDomain.existsById.mockResolvedValue(false);

            await expect(
                service.updateProfile('user-id', {
                    countryId: 'missing-country-id',
                    gender: EnumUserGender.male,
                })
            ).rejects.toBeInstanceOf(CountryNotFoundException);
            expect(userRepository.updateProfile).not.toHaveBeenCalled();
        });
    });

    describe('generatePhotoProfilePresign', () => {
        it('creates a private signed upload scoped to the user profile with the extension content type and size', async () => {
            await expect(
                service.generatePhotoProfilePresign(userId, {
                    extension: EnumFileExtensionImage.png,
                    size: 100,
                })
            ).resolves.toEqual(signedUpload);

            expect(
                objectStorageService.createSignedUpload
            ).toHaveBeenCalledWith(scopePrefix, {
                contentType: 'image/png',
                size: 100,
            });
        });

        it('maps a jpg extension onto the image/jpeg content type', async () => {
            await service.generatePhotoProfilePresign(userId, {
                extension: EnumFileExtensionImage.jpg,
                size: 100,
            });

            expect(
                objectStorageService.createSignedUpload
            ).toHaveBeenCalledWith(scopePrefix, {
                contentType: 'image/jpeg',
                size: 100,
            });
        });

        it('throws StorageSizeInvalidException without signing when the size is 0', async () => {
            await expect(
                service.generatePhotoProfilePresign(userId, {
                    extension: EnumFileExtensionImage.png,
                    size: 0,
                })
            ).rejects.toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.sizeInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.sizeInvalid
                    ],
                messagePath: 'storage.error.sizeInvalid',
            });
            expect(
                objectStorageService.createSignedUpload
            ).not.toHaveBeenCalled();
        });

        it('throws UserPhotoSizeExceededException without signing when the size is above the configured photo maximum', async () => {
            await expect(
                service.generatePhotoProfilePresign(userId, {
                    extension: EnumFileExtensionImage.png,
                    size: maxSizeInBytes + 1,
                })
            ).rejects.toMatchObject({
                module: 'user',
                statusCode: EnumUserStatusCodeError.photoSizeExceeded,
                statusCodeKey:
                    EnumUserStatusCodeError[
                        EnumUserStatusCodeError.photoSizeExceeded
                    ],
                messagePath: 'user.error.photoSizeExceeded',
                httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
            });
            expect(
                objectStorageService.createSignedUpload
            ).not.toHaveBeenCalled();
        });

        it('accepts a size equal to the photo maximum', async () => {
            await service.generatePhotoProfilePresign(userId, {
                extension: EnumFileExtensionImage.png,
                size: maxSizeInBytes,
            });

            expect(
                objectStorageService.createSignedUpload
            ).toHaveBeenCalledWith(scopePrefix, {
                contentType: 'image/png',
                size: maxSizeInBytes,
            });
        });
    });

    describe('updatePhotoProfile', () => {
        it('verifies the staged key against the user scope, the photo maximum and the image content types', async () => {
            await service.updatePhotoProfile(userId, { key: stagedKey });

            expect(objectStorageService.verifyStaged).toHaveBeenCalledWith(
                stagedKey,
                {
                    scopePrefix,
                    maxSizeInBytes,
                    contentTypes: photoContentTypes,
                }
            );
        });

        it('promotes the verified object to the public disk under the user scope and stores the promoted metadata', async () => {
            await service.updatePhotoProfile(userId, { key: stagedKey });

            expect(objectStorageService.promote).toHaveBeenCalledWith(staged, {
                visibility: EnumStorageVisibility.public,
                scopePrefix,
            });
            expect(userRepository.updatePhotoProfile).toHaveBeenCalledWith(
                userId,
                promoted
            );
            expect(activityLogDomain.prepare).toHaveBeenCalledWith({
                action: EnumActivityLogAction.userUpdatePhotoProfile,
            });
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
        });

        it('deletes the staged object and the previous photo only after the database update commits', async () => {
            const callOrder: string[] = [];
            userRepository.updatePhotoProfile.mockImplementation(async () => {
                callOrder.push('update');
                return previousPhoto;
            });
            objectStorageService.delete.mockImplementation(async ({ key }) => {
                callOrder.push(`delete:${key}`);
            });

            await service.updatePhotoProfile(userId, { key: stagedKey });

            expect(callOrder[0]).toBe('update');
            expect(callOrder).toEqual(
                expect.arrayContaining([
                    `delete:${stagedKey}`,
                    `delete:${previousPhoto.key}`,
                ])
            );
            expect(objectStorageService.delete).toHaveBeenCalledTimes(2);
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: stagedKey,
                visibility: EnumStorageVisibility.private,
            });
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: previousPhoto.key,
                visibility: previousPhoto.visibility,
            });
        });

        it('deletes only the staged object when the user had no previous photo', async () => {
            userRepository.updatePhotoProfile.mockResolvedValue(null);

            await service.updatePhotoProfile(userId, { key: stagedKey });

            expect(objectStorageService.delete).toHaveBeenCalledTimes(1);
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: stagedKey,
                visibility: EnumStorageVisibility.private,
            });
        });

        it('rejects a foreign or traversal key as StorageKeyInvalidException with no promotion and no database write', async () => {
            objectStorageService.verifyStaged.mockRejectedValue(
                new StorageKeyInvalidException()
            );

            await expect(
                service.updatePhotoProfile(userId, {
                    key: 'incoming/users/other-user/profile/../photo.png',
                })
            ).rejects.toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.keyInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.keyInvalid
                    ],
                messagePath: 'storage.error.keyInvalid',
            });
            expect(objectStorageService.verifyStaged).toHaveBeenCalledWith(
                'incoming/users/other-user/profile/../photo.png',
                expect.objectContaining({ scopePrefix })
            );
            expect(objectStorageService.promote).not.toHaveBeenCalled();
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
            expect(objectStorageService.delete).not.toHaveBeenCalled();
        });

        it('rejects a missing staged object as StorageObjectNotFoundException with no promotion and no database write', async () => {
            objectStorageService.verifyStaged.mockRejectedValue(
                new StorageObjectNotFoundException()
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).rejects.toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.objectNotFound,
                messagePath: 'storage.error.objectNotFound',
            });
            expect(objectStorageService.promote).not.toHaveBeenCalled();
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
        });

        it('rejects staged bytes that are not an image as StorageContentTypeInvalidException with nothing promoted', async () => {
            objectStorageService.verifyStaged.mockRejectedValue(
                new StorageContentTypeInvalidException()
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).rejects.toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.contentTypeInvalid,
                messagePath: 'storage.error.contentTypeInvalid',
            });
            expect(objectStorageService.promote).not.toHaveBeenCalled();
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
        });

        it('rejects an oversize staged object as StorageSizeInvalidException with nothing promoted', async () => {
            objectStorageService.verifyStaged.mockRejectedValue(
                new StorageSizeInvalidException()
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).rejects.toBeInstanceOf(StorageSizeInvalidException);
            expect(objectStorageService.promote).not.toHaveBeenCalled();
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
        });

        it('writes nothing when the promotion fails', async () => {
            objectStorageService.promote.mockRejectedValue(
                new StoragePromotionFailedException(new Error('copy failed'))
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).rejects.toBeInstanceOf(StoragePromotionFailedException);
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
            expect(objectStorageService.delete).not.toHaveBeenCalled();
        });

        it('deletes the promoted object, keeps the staged object and rethrows as AppUnknownException when the database update fails', async () => {
            userRepository.updatePhotoProfile.mockRejectedValue(
                new Error('db down')
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).rejects.toMatchObject({
                module: 'app',
                statusCode: EnumAppStatusCodeError.unknown,
            });
            expect(objectStorageService.delete).toHaveBeenCalledTimes(1);
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: promoted.key,
                visibility: promoted.visibility,
            });
            expect(activityLogDomain.stagePrepared).not.toHaveBeenCalled();
        });

        it('resolves when deleting the staged object or the previous photo fails after the commit', async () => {
            objectStorageService.delete.mockRejectedValue(
                new Error('delete failed')
            );

            await expect(
                service.updatePhotoProfile(userId, { key: stagedKey })
            ).resolves.toBeUndefined();
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
        });
    });

    describe('uploadPhotoProfile', () => {
        it('stores the uploaded asset metadata and stages the activity event', async () => {
            await service.uploadPhotoProfile(userId, stored);

            expect(userRepository.updatePhotoProfile).toHaveBeenCalledWith(
                userId,
                stored
            );
            expect(activityLogDomain.prepare).toHaveBeenCalledWith({
                action: EnumActivityLogAction.userUpdatePhotoProfile,
            });
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
        });

        it('deletes the previous photo after the database update commits', async () => {
            const callOrder: string[] = [];
            userRepository.updatePhotoProfile.mockImplementation(async () => {
                callOrder.push('update');
                return previousPhoto;
            });
            objectStorageService.delete.mockImplementation(async () => {
                callOrder.push('delete');
            });

            await service.uploadPhotoProfile(userId, stored);

            expect(callOrder).toEqual(['update', 'delete']);
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: previousPhoto.key,
                visibility: previousPhoto.visibility,
            });
        });

        it('deletes nothing on a first upload with no previous photo', async () => {
            userRepository.updatePhotoProfile.mockResolvedValue(null);

            await service.uploadPhotoProfile(userId, stored);

            expect(objectStorageService.delete).not.toHaveBeenCalled();
        });

        it('deletes the new object and rethrows as AppUnknownException when the database update fails', async () => {
            const failure = new Error('db down');
            userRepository.updatePhotoProfile.mockRejectedValue(failure);

            await expect(
                service.uploadPhotoProfile(userId, stored)
            ).rejects.toMatchObject({
                module: 'app',
                statusCode: EnumAppStatusCodeError.unknown,
                statusCodeKey:
                    EnumAppStatusCodeError[EnumAppStatusCodeError.unknown],
                messagePath: 'http.serverError.internalServerError',
                rawError: failure,
            });
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: stored.key,
                visibility: stored.visibility,
            });
            expect(activityLogDomain.stagePrepared).not.toHaveBeenCalled();
        });

        it('deletes the new object and rethrows the typed exception unchanged when the activity contract fails', async () => {
            const exception = new StorageKeyInvalidException();
            activityLogDomain.prepare.mockImplementation(() => {
                throw exception;
            });

            await expect(
                service.uploadPhotoProfile(userId, stored)
            ).rejects.toBe(exception);
            expect(userRepository.updatePhotoProfile).not.toHaveBeenCalled();
            expect(objectStorageService.delete).toHaveBeenCalledWith({
                key: stored.key,
                visibility: stored.visibility,
            });
        });

        it('resolves when deleting the previous photo fails after the commit', async () => {
            objectStorageService.delete.mockRejectedValue(
                new Error('delete failed')
            );

            await expect(
                service.uploadPhotoProfile(userId, stored)
            ).resolves.toBeUndefined();
        });

        it('rejects with the original failure when the compensating delete also fails', async () => {
            userRepository.updatePhotoProfile.mockRejectedValue(
                new Error('db down')
            );
            objectStorageService.delete.mockRejectedValue(
                new Error('delete failed')
            );

            await expect(
                service.uploadPhotoProfile(userId, stored)
            ).rejects.toBeInstanceOf(AppUnknownException);
        });
    });

    describe('claimUsername', () => {
        it('claims an available username', async () => {
            await service.claimUsername('user-id', 'newname');

            expect(userRepository.claimUsername).toHaveBeenCalledWith(
                'user-id',
                { username: 'newname' }
            );
        });

        it('throws UserUsernameNotAllowedException before checking other username failures', async () => {
            userUtil.checkUsernamePattern.mockReturnValue(true);
            userUtil.checkBadWord.mockResolvedValue(true);
            userRepository.existsByUsername.mockResolvedValue(true);

            await expect(
                service.claimUsername('user-id', 'bad')
            ).rejects.toBeInstanceOf(UserUsernameNotAllowedException);
            expect(userRepository.claimUsername).not.toHaveBeenCalled();
        });

        it('throws UserUsernameContainBadWordException when the username contains a bad word', async () => {
            userUtil.checkBadWord.mockResolvedValue(true);

            await expect(
                service.claimUsername('user-id', 'badword')
            ).rejects.toBeInstanceOf(UserUsernameContainBadWordException);
        });

        it('throws UserUsernameExistException when the username already exists', async () => {
            userRepository.existsByUsername.mockResolvedValue(true);

            await expect(
                service.claimUsername('user-id', 'taken')
            ).rejects.toBeInstanceOf(UserUsernameExistException);
        });
    });
});
