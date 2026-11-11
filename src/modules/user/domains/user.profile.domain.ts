import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import type {
    IStorageSignedUpload,
    IStoredAsset,
    IStoredAssetReference,
} from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
} from '@generated/prisma-client/client';
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
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mime from 'mime';

@Injectable()
export class UserProfileDomain {
    private readonly logger = new Logger(UserProfileDomain.name);

    private readonly photoScopePrefixPattern: string;
    private readonly photoMaxSizeInBytes: number;
    private readonly photoContentTypes: string[];

    constructor(
        private readonly userRepository: UserRepository,
        private readonly activityLogDomain: ActivityLogDomain,
        private readonly countryDomain: CountryDomain,
        private readonly userUtil: UserUtil,
        private readonly objectStorageService: ObjectStorageService,
        private readonly configService: ConfigService
    ) {
        this.photoScopePrefixPattern = this.configService.get<string>(
            'user.photo.scopePrefixPattern'
        )!;
        this.photoMaxSizeInBytes = this.configService.get<number>(
            'user.photo.maxSizeInBytes'
        )!;
        const contentTypes = Object.values(EnumFileExtensionImage)
            .map(extension => Mime.getType(extension))
            .filter(
                (contentType): contentType is string => contentType !== null
            );
        this.photoContentTypes = [...new Set(contentTypes)];
    }

    private createPhotoScopePrefix(userId: string): string {
        return this.photoScopePrefixPattern.replace('{userId}', () => userId);
    }

    private async deleteQuietly({
        key,
        visibility,
    }: IStoredAssetReference): Promise<void> {
        try {
            await this.objectStorageService.delete({ key, visibility });
        } catch (error: unknown) {
            this.logger.error(
                error,
                `Failed to delete ${visibility} profile photo object ${key}`
            );
        }
    }

    private async savePhoto(
        userId: string,
        asset: IStoredAsset
    ): Promise<UserPhoto | null> {
        try {
            const events = [
                this.activityLogDomain.prepare({
                    action: EnumActivityLogAction.userUpdatePhotoProfile,
                }),
            ];
            const previous = await this.userRepository.updatePhotoProfile(
                userId,
                asset
            );

            this.activityLogDomain.stagePrepared(events);

            return previous;
        } catch (err: unknown) {
            await this.deleteQuietly(asset);

            if (err instanceof AppBaseException) {
                throw err;
            }

            throw new AppUnknownException(err);
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
        if (size < 1) {
            throw new StorageSizeInvalidException();
        } else if (size > this.photoMaxSizeInBytes) {
            throw new UserPhotoSizeExceededException();
        }

        const contentType = Mime.getType(extension);
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
        const staged = await this.objectStorageService.verifyStaged(key, {
            scopePrefix,
            maxSizeInBytes: this.photoMaxSizeInBytes,
            contentTypes: this.photoContentTypes,
        });
        const promoted = await this.objectStorageService.promote(staged, {
            visibility: EnumStorageVisibility.public,
            scopePrefix,
        });

        const previous = await this.savePhoto(userId, promoted);

        const cleanups = [this.deleteQuietly(staged)];
        if (previous) {
            const previousCleanup = this.deleteQuietly(previous);
            cleanups.push(previousCleanup);
        }
        await Promise.all(cleanups);
    }

    async uploadPhotoProfile(
        userId: string,
        stored: IStoredAsset
    ): Promise<void> {
        const previous = await this.savePhoto(userId, stored);
        if (previous) {
            await this.deleteQuietly(previous);
        }
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
