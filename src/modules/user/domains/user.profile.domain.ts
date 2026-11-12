import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import type {
    IStorageSignedUpload,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageContentTypeUtil } from '@common/storage/utils/storage.content-type.util';
import { EnumActivityLogAction } from '@generated/prisma-client/client';
import type { UserPhoto } from '@generated/prisma-client/client';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import { CountryNotFoundException } from '@modules/country/exceptions/country.not-found.exception';
import { CountryDomain } from '@modules/country/domains/country.domain';
import type { UserUpdateProfilePhotoRequestDto } from '@modules/user/dtos/request/user.update-profile-photo.request.dto';
import { UserNotFoundException } from '@modules/user/exceptions/user.not-found.exception';
import { UserPhotoSizeExceededException } from '@modules/user/exceptions/user.photo-size-exceeded.exception';
import { UserUsernameContainBadWordException } from '@modules/user/exceptions/user.username-contain-bad-word.exception';
import { UserUsernameExistException } from '@modules/user/exceptions/user.username-exist.exception';
import { UserUsernameNotAllowedException } from '@modules/user/exceptions/user.username-not-allowed.exception';
import type {
    IUserGeneratePhotoProfile,
    IUserProfile,
    IUserUpdateProfile,
} from '@modules/user/interfaces/user.interface';
import { UserRepository } from '@modules/user/repositories/user.repository';
import { UserUtil } from '@modules/user/utils/user.util';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserProfileDomain {
    private readonly photoScopePrefixPattern: string;
    private readonly photoMaxSizeInBytes: number;
    private readonly photoContentTypes: string[];

    constructor(
        private readonly userRepository: UserRepository,
        private readonly activityLogDomain: ActivityLogDomain,
        private readonly countryDomain: CountryDomain,
        private readonly userUtil: UserUtil,
        private readonly objectStorageService: ObjectStorageService,
        private readonly storageContentTypeUtil: StorageContentTypeUtil,
        private readonly configService: ConfigService
    ) {
        this.photoScopePrefixPattern = this.configService.get<string>(
            'user.photo.scopePrefixPattern'
        )!;
        this.photoMaxSizeInBytes = this.configService.get<number>(
            'user.photo.maxSizeInBytes'
        )!;
        this.photoContentTypes = this.storageContentTypeUtil.fromExtensions(
            Object.values(EnumFileExtensionImage)
        );
    }

    private createPhotoScopePrefix(userId: string): string {
        return this.photoScopePrefixPattern.replace('{userId}', () => userId);
    }

    private async savePhoto(
        userId: string,
        asset: IStoredAsset
    ): Promise<void> {
        let previous: UserPhoto | null;
        try {
            const events = [
                this.activityLogDomain.prepare({
                    action: EnumActivityLogAction.userUpdatePhotoProfile,
                }),
            ];
            previous = await this.userRepository.updatePhotoProfile(
                userId,
                asset
            );

            this.activityLogDomain.stagePrepared(events);
        } catch (err: unknown) {
            await this.objectStorageService.deleteQuietly(asset);

            if (err instanceof AppBaseException) {
                throw err;
            }

            throw new AppUnknownException(err);
        }

        if (previous && previous.key !== asset.key) {
            await this.objectStorageService.deleteQuietly(previous);
        }
    }

    async getProfile(userId: string): Promise<IUserProfile> {
        const user = await this.userRepository.findOneActiveProfileById(userId);
        if (!user) {
            throw new UserNotFoundException();
        }

        return user;
    }

    async updateProfile(
        userId: string,
        { countryId, ...data }: IUserUpdateProfile
    ): Promise<void> {
        const checkCountry = await this.countryDomain.existsById(countryId);
        if (!checkCountry) {
            throw new CountryNotFoundException();
        }

        try {
            const events = [
                this.activityLogDomain.prepare({
                    action: EnumActivityLogAction.userUpdateProfile,
                }),
            ];
            await this.userRepository.updateProfile(userId, {
                countryId,
                ...data,
            });

            this.activityLogDomain.stagePrepared(events);

            return;
        } catch (err: unknown) {
            if (err instanceof AppBaseException) {
                throw err;
            }

            throw new AppUnknownException(err);
        }
    }

    async generatePhotoProfilePresign(
        userId: string,
        { extension, size }: IUserGeneratePhotoProfile
    ): Promise<IStorageSignedUpload> {
        if (size > this.photoMaxSizeInBytes) {
            throw new UserPhotoSizeExceededException();
        }

        const contentType =
            this.storageContentTypeUtil.fromExtension(extension);
        if (!contentType) {
            throw new StorageContentTypeInvalidException();
        }

        const scopePrefix = this.createPhotoScopePrefix(userId);

        return this.objectStorageService.createSignedUpload(scopePrefix, {
            contentType,
            size,
        });
    }

    async updatePhotoProfile(
        userId: string,
        { key }: UserUpdateProfilePhotoRequestDto
    ): Promise<void> {
        const scopePrefix = this.createPhotoScopePrefix(userId);
        const verified = await this.objectStorageService.verifyUpload(key, {
            scopePrefix,
            maxSizeInBytes: this.photoMaxSizeInBytes,
            contentTypes: this.photoContentTypes,
        });

        await this.savePhoto(userId, verified);
    }

    async uploadPhotoProfile(
        userId: string,
        stored: IStoredAsset
    ): Promise<void> {
        await this.savePhoto(userId, stored);
    }

    async claimUsername(
        userId: string,
        username: Lowercase<string>
    ): Promise<void> {
        const [checkUsername, checkBadWord, exist] = await Promise.all([
            this.userUtil.checkUsernamePattern(username),
            this.userUtil.checkBadWord(username),
            this.userRepository.existsByUsername(username),
        ]);
        if (checkUsername) {
            throw new UserUsernameNotAllowedException();
        } else if (checkBadWord) {
            throw new UserUsernameContainBadWordException();
        } else if (exist) {
            throw new UserUsernameExistException();
        }

        try {
            const events = [
                this.activityLogDomain.prepare({
                    action: EnumActivityLogAction.userClaimUsername,
                }),
            ];
            await this.userRepository.claimUsername(userId, { username });

            this.activityLogDomain.stagePrepared(events);

            return;
        } catch (err: unknown) {
            if (err instanceof AppBaseException) {
                throw err;
            }

            throw new AppUnknownException(err);
        }
    }
}
