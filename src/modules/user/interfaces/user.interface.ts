import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import {
    Country,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumVerificationType,
    Prisma,
    Role,
    TwoFactor,
    User,
    UserMobileNumber,
} from '@prisma/client';

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
    expiredAt: Date;
    jti: string;
    sessionId: string;
}

export interface IUserForgotPasswordCreate {
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    link: string;
}

export interface IUserVerificationCreate {
    type: EnumVerificationType;
    expiredAt: Date;
    expiredInMinutes: number;
    resendInMinutes: number;
    reference: string;
    token: string;
    link?: string;
}

export type IUserPaginationOffsetParams = IPaginationQueryOffsetParams<
    Prisma.UserSelect,
    Prisma.UserWhereInput
>;

export type IUserAssetPaginationOffsetParams = IPaginationQueryOffsetParams<
    Prisma.AssetSelect,
    Prisma.AssetWhereInput
>;
