import {
    EnumRoleType,
    EnumStorageVisibility,
    EnumUserGender,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumUserSignUpFrom,
    EnumUserSignUpWith,
    EnumUserStatus,
} from '@generated/prisma-client/client';
import { UserProfileResponseSchema } from '@modules/user/dtos/response/user.profile.response.dto';

describe('UserProfileResponseSchema', () => {
    const buildProfile = (photo: unknown) => {
        const now = new Date();
        const audit = {
            id: 'id',
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
        };
        const country = {
            ...audit,
            name: 'Italy',
            alpha2Code: 'IT',
            alpha3Code: 'ITA',
            phoneCodes: ['39'],
            continent: 'Europe',
            timezone: 'Europe/Rome',
        };
        return {
            ...audit,
            deletedAt: null,
            deletedBy: null,
            name: null,
            username: 'user',
            isVerified: true,
            verifiedAt: null,
            email: 'user@example.com',
            roleId: 'role-id',
            role: {
                ...audit,
                name: 'User',
                description: null,
                type: EnumRoleType.user,
                policies: [],
            },
            passwordExpired: null,
            passwordCreated: null,
            passwordAttempt: null,
            signUpAt: now,
            signUpFrom: EnumUserSignUpFrom.website,
            signUpWith: EnumUserSignUpWith.credential,
            status: EnumUserStatus.active,
            countryId: 'country-id',
            gender: EnumUserGender.female,
            lastLoginAt: null,
            lastIPAddress: null,
            lastLoginFrom: EnumUserLoginFrom.website,
            lastLoginWith: EnumUserLoginWith.credential,
            termsOfServiceAccepted: true,
            privacyAccepted: true,
            cookiesAccepted: true,
            marketingAccepted: false,
            photo,
            twoFactor: null,
            country,
            mobileNumbers: [
                {
                    ...audit,
                    number: '12345678',
                    phoneCode: '39',
                    country,
                    secret: 'hidden',
                },
            ],
            password: 'hidden',
        };
    };

    it('selects a profile, nested country, and mobile numbers without secrets, and strips the photo size and etag', () => {
        const result = UserProfileResponseSchema.parse(
            buildProfile({
                key: 'users/user-id/profile/photo.jpg',
                visibility: EnumStorageVisibility.public,
                contentType: 'image/jpeg',
                size: 1024,
                etag: '"etag"',
                url: 'https://cdn.example.com/users/user-id/profile/photo.jpg',
                internal: true,
            })
        );

        expect(result.name).toBeNull();
        expect(result.photo).toEqual({
            key: 'users/user-id/profile/photo.jpg',
            visibility: EnumStorageVisibility.public,
            contentType: 'image/jpeg',
            url: 'https://cdn.example.com/users/user-id/profile/photo.jpg',
        });
        expect(result.mobileNumbers[0]).not.toHaveProperty('secret');
        expect(result).not.toHaveProperty('password');
    });

    it('accepts a private photo with a null url', () => {
        const result = UserProfileResponseSchema.parse(
            buildProfile({
                key: 'users/user-id/profile/photo.jpg',
                visibility: EnumStorageVisibility.private,
                contentType: 'image/jpeg',
                size: 1024,
                etag: null,
                url: null,
            })
        );

        expect(result.photo?.url).toBeNull();
    });

    it('accepts an absent photo as null', () => {
        const result = UserProfileResponseSchema.parse(buildProfile(null));

        expect(result.photo).toBeNull();
    });

    it('rejects the legacy S3 photo shape carrying bucket and completedUrl', () => {
        const result = UserProfileResponseSchema.safeParse(
            buildProfile({
                bucket: 'bucket',
                key: 'profile.jpg',
                cdnUrl: null,
                completedUrl: 'https://example.com/profile.jpg',
                mime: 'image/jpeg',
                extension: 'jpg',
                access: EnumStorageVisibility.public,
            })
        );

        expect(result.success).toBe(false);
    });
});
