import {
    Country,
    Device,
    DeviceOwnership,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumVerificationType,
    Role,
    TwoFactor,
    User,
    UserMobileNumber,
} from '@generated/prisma-client';

export interface IUser extends User {
    role: Role;
    twoFactor: TwoFactor;
}

export interface IUserMobileNumber extends UserMobileNumber {
    country: Country;
}

export interface IUserProfile extends IUser {
    mobileNumbers: IUserMobileNumber[];
    country: Country;
}

export interface IUserLogin {
    loginFrom: EnumUserLoginFrom;
    loginWith: EnumUserLoginWith;
}

export interface IUserRefresh {
    sessionId: string;
    jti: string;
    loginFrom: EnumUserLoginFrom;
    loginWith: EnumUserLoginWith;
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

export interface IUserVerificationCreate {
    type: EnumVerificationType;
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    hashedToken: string;
    link?: string;
    encryptedLink?: string;
}
