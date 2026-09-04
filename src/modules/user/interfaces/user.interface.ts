import {
    Country,
    Device,
    DeviceOwnership,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    ForgotPassword,
    Role,
    RoleAbility,
    TwoFactor,
    TwoFactorBackupCode,
    User,
    UserMobileNumber,
    UserPhoto,
} from '@generated/prisma-client';

interface IUserRole extends Role {
    abilities: RoleAbility[];
}

interface IUserWithRole extends User {
    role: IUserRole;
}

export interface IUser extends IUserWithRole {
    twoFactor: IUserTwoFactor | null;
}

export interface IUserWithPhoto extends IUserWithRole {
    photo: UserPhoto | null;
}

export type IUserExport = IUserWithPhoto;

export interface IUserTwoFactor extends TwoFactor {
    backupCodes: TwoFactorBackupCode[];
}

export interface IUserMobileNumber extends UserMobileNumber {
    country: Country;
}

export interface IUserProfile extends IUserWithRole {
    twoFactor: TwoFactor | null;
    mobileNumbers: IUserMobileNumber[];
    country: Country;
    photo: UserPhoto | null;
}

export interface IUserForgotPasswordWithUser extends ForgotPassword {
    user: IUser;
}

export interface IUserLogin {
    loginFrom: EnumUserLoginFrom;
    loginWith: EnumUserLoginWith;
    expiredAt: Date;
    jti: string;
    sessionId: string;
}

export interface IUserLoginResult {
    user: User;
    device: Device;
    deviceOwnership: DeviceOwnership;
    isNewDevice: boolean;
    sessionShouldBeInactive?: { id: string }[];
}

export interface IUserForgotPasswordCreate {
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    hashedToken: string;
    link: string;
    encryptedLink: string;
}

export interface IUserVerificationEmailCreate {
    type: 'email';
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    hashedToken: string;
    link: string;
    encryptedLink: string;
}

export interface IUserVerificationMobileNumberCreate {
    type: 'mobileNumber';
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    hashedToken: string;
}

export type IUserVerificationCreate =
    | IUserVerificationEmailCreate
    | IUserVerificationMobileNumberCreate;
