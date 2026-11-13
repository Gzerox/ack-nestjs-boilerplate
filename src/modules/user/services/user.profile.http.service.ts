import type {
    IStorageSignedUpload,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { IResponseReturn } from '@common/response/interfaces/response.interface';
import type { UserClaimUsernameRequestDto } from '@modules/user/dtos/request/user.claim-username.request.dto';
import type { UserGeneratePhotoProfileRequestDto } from '@modules/user/dtos/request/user.generate-photo-profile.request.dto';
import type { UserUpdateProfilePhotoRequestDto } from '@modules/user/dtos/request/user.update-profile-photo.request.dto';
import type { UserUpdateProfileRequestDto } from '@modules/user/dtos/request/user.update-profile.request.dto';
import type { IUserProfile } from '@modules/user/interfaces/user.interface';
import { UserProfileDomain } from '@modules/user/domains/user.profile.domain';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserProfileHttpService {
    constructor(
        private readonly userProfileDomain: UserProfileDomain,
        private readonly objectStorageService: ObjectStorageService
    ) {}

    async getProfile(userId: string): Promise<IResponseReturn<IUserProfile>> {
        const user = await this.userProfileDomain.getProfile(userId);
        const photo = this.objectStorageService.toAssetResponse(user.photo);

        return { data: { ...user, photo } };
    }

    async updateProfile(
        userId: string,
        { countryId, gender, name }: UserUpdateProfileRequestDto
    ): Promise<void> {
        await this.userProfileDomain.updateProfile(userId, {
            countryId,
            gender,
            name,
        });
    }

    async generatePhotoProfilePresign(
        userId: string,
        { extension, size }: UserGeneratePhotoProfileRequestDto
    ): Promise<IResponseReturn<IStorageSignedUpload>> {
        const presign =
            await this.userProfileDomain.generatePhotoProfilePresign(userId, {
                extension,
                size,
            });

        return { data: presign };
    }

    async updatePhotoProfile(
        userId: string,
        { key }: UserUpdateProfilePhotoRequestDto
    ): Promise<void> {
        await this.userProfileDomain.updatePhotoProfile(userId, { key });
    }

    async uploadPhotoProfile(
        userId: string,
        stored: IStoredAsset
    ): Promise<void> {
        await this.userProfileDomain.uploadPhotoProfile(userId, stored);
    }

    async claimUsername(
        userId: string,
        { username }: UserClaimUsernameRequestDto
    ): Promise<void> {
        await this.userProfileDomain.claimUsername(userId, username);
    }
}
