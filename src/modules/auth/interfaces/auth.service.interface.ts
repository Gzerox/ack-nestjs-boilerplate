import { IRequestApp } from '@common/request/interfaces/request.interface';
import {
    IAuthBetterCreateSession,
    IAuthBetterSessionData,
    IAuthJwtAccessTokenPayload,
    IAuthJwtRefreshTokenPayload,
    IAuthSocialPayload,
} from '@modules/auth/interfaces/auth.interface';
import { IUser } from '@modules/user/interfaces/user.interface';

export interface IAuthService {
    validateJwtAccessRequest(
        request: IRequestApp<IAuthJwtAccessTokenPayload>
    ): Promise<IAuthJwtAccessTokenPayload>;
    validateJwtRefreshRequest(
        request: IRequestApp<IAuthJwtRefreshTokenPayload>
    ): Promise<IAuthJwtRefreshTokenPayload>;
    validateOAuthAppleGuard(
        request: IRequestApp<IAuthSocialPayload>
    ): Promise<boolean>;
    validateOAuthGoogleGuard(
        request: IRequestApp<IAuthSocialPayload>
    ): Promise<boolean>;
    createSession(
        user: IUser,
        options: IAuthBetterCreateSession
    ): Promise<{ id: string; token: string; expiresAt: Date }>;
    deleteSessionByToken(token: string): Promise<void>;
    findSessionByToken(token: string): Promise<{
        session: Record<string, unknown> & IAuthBetterSessionData;
        user: Record<string, unknown> & { id: string };
    } | null>;
}
