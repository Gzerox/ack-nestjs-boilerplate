import { IRequestApp } from '@common/request/interfaces/request.interface';
import { EnumAuthStatusCodeError } from '@modules/auth/enums/auth.status-code.enum';
import {
    IAuthBetterCreateSession,
    IAuthBetterSessionData,
    IAuthJwtAccessTokenPayload,
    IAuthJwtRefreshTokenPayload,
    IAuthSocialPayload,
} from '@modules/auth/interfaces/auth.interface';
import { IAuthService } from '@modules/auth/interfaces/auth.service.interface';
import { AuthUtil } from '@modules/auth/utils/auth.util';
import { EnumSessionStatusCodeError } from '@modules/session/enums/session.status-code.enum';
import { SessionRepository } from '@modules/session/repositories/session.repository';
import { SessionUtil } from '@modules/session/utils/session.util';
import { EnumUserLoginFrom, EnumUserLoginWith } from '@generated/prisma-client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenPayload } from 'google-auth-library';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuthInstance } from '@modules/auth/services/auth.better.factory';
import { IUser } from '@modules/user/interfaces/user.interface';

@Injectable()
export class AuthService implements IAuthService {
    constructor(
        private readonly authUtil: AuthUtil,
        private readonly betterAuthService: BetterAuthService<BetterAuthInstance>,
        private readonly sessionRepository: SessionRepository,
        private readonly sessionUtil: SessionUtil
    ) {}

    async validateJwtAccessRequest(
        request: IRequestApp<IAuthJwtAccessTokenPayload>
    ): Promise<IAuthJwtAccessTokenPayload> {
        const requestHeaders = this.authUtil.extractHeaderJwt(request);
        if (requestHeaders.length !== 2) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtAccessTokenInvalid,
                message: 'auth.error.accessTokenUnauthorized',
            });
        }

        const payload = await this.authUtil.verifyAccessToken(
            requestHeaders[1]
        );
        if (!payload) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtAccessTokenInvalid,
                message: 'auth.error.accessTokenUnauthorized',
            });
        }

        const { sub, userId, sessionId, jti } = payload;
        if (
            !sub ||
            !userId ||
            !sessionId ||
            typeof sub !== 'string' ||
            typeof userId !== 'string' ||
            typeof sessionId !== 'string' ||
            typeof jti !== 'string' ||
            sub !== userId
        ) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtAccessTokenInvalid,
                message: 'auth.error.accessTokenUnauthorized',
            });
        }

        const cached = await this.sessionUtil.getLogin(userId, sessionId);
        if (cached) {
            if (cached.jti !== jti) {
                throw new UnauthorizedException({
                    statusCode: EnumSessionStatusCodeError.forbidden,
                    message: 'session.error.forbidden',
                });
            }
            return payload;
        }

        const domainSession = await this.sessionRepository.findOneActive(
            userId,
            sessionId
        );
        if (!domainSession || domainSession.jti !== jti) {
            throw new UnauthorizedException({
                statusCode: EnumSessionStatusCodeError.forbidden,
                message: 'session.error.forbidden',
            });
        }

        return payload;
    }

    async validateJwtRefreshRequest(
        request: IRequestApp<IAuthJwtRefreshTokenPayload>
    ): Promise<IAuthJwtRefreshTokenPayload> {
        const requestHeaders = this.authUtil.extractHeaderJwt(request);
        if (requestHeaders.length !== 2) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtRefreshTokenInvalid,
                message: 'auth.error.refreshTokenUnauthorized',
            });
        }

        const refreshToken = requestHeaders[1];
        const sessionData = await this.findSessionByToken(refreshToken);
        if (!sessionData) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtRefreshTokenInvalid,
                message: 'auth.error.refreshTokenUnauthorized',
            });
        }

        const domainSession = await this.sessionRepository.findOneActive(
            sessionData.user.id,
            sessionData.session.id
        );
        if (!domainSession) {
            throw new UnauthorizedException({
                statusCode: EnumSessionStatusCodeError.forbidden,
                message: 'session.error.forbidden',
            });
        }

        if (!sessionData.session.loginAt) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtRefreshTokenInvalid,
                message: 'auth.error.refreshTokenUnauthorized',
            });
        }
        const loginAtDate = sessionData.session.loginAt;
        if (
            !sessionData.session.loginFrom ||
            !sessionData.session.loginWith ||
            !sessionData.session.deviceOwnershipId
        ) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.jwtRefreshTokenInvalid,
                message: 'auth.error.refreshTokenUnauthorized',
            });
        }

        return {
            sub: sessionData.user.id,
            userId: sessionData.user.id,
            sessionId: sessionData.session.id,
            deviceOwnershipId: sessionData.session.deviceOwnershipId,
            loginAt: loginAtDate,
            loginFrom: sessionData.session.loginFrom as EnumUserLoginFrom,
            loginWith: sessionData.session.loginWith as EnumUserLoginWith,
            jti: domainSession.jti,
        };
    }

    async validateOAuthAppleGuard(
        request: IRequestApp<IAuthSocialPayload>
    ): Promise<boolean> {
        const requestHeaders = this.authUtil.extractHeaderApple(request);
        if (requestHeaders.length !== 2) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.socialGoogleRequired,
                message: 'auth.error.socialAppleRequired',
            });
        }

        try {
            const payload = await this.authUtil.verifyApple(requestHeaders[1]);

            request.user = {
                email: payload.email,
                emailVerified: payload.email_verified,
            };

            return true;
        } catch (err: unknown) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.socialGoogleInvalid,
                message: 'auth.error.socialAppleInvalid',
                _error: err,
            });
        }
    }

    async validateOAuthGoogleGuard(
        request: IRequestApp<IAuthSocialPayload>
    ): Promise<boolean> {
        const requestHeaders = this.authUtil.extractHeaderGoogle(request);

        if (requestHeaders.length !== 2) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.socialGoogleRequired,
                message: 'auth.error.socialGoogleRequired',
            });
        }

        try {
            const payload: TokenPayload = await this.authUtil.verifyGoogle(
                requestHeaders[1]
            );

            request.user = {
                email: payload.email,
                emailVerified: payload.email_verified,
            };

            return true;
        } catch (err: unknown) {
            throw new UnauthorizedException({
                statusCode: EnumAuthStatusCodeError.socialGoogleInvalid,
                message: 'auth.error.socialGoogleInvalid',
                _error: err,
            });
        }
    }

    async createSession(
        user: IUser,
        {
            expiresAt,
            ipAddress,
            userAgent,
            jti,
            deviceOwnershipId,
            loginAt,
            loginFrom,
            loginWith,
        }: IAuthBetterCreateSession
    ): Promise<{ id: string; token: string; expiresAt: Date }> {
        const context = await this.betterAuthService.instance.$context;

        return context.internalAdapter.createSession(user.id, false, {
            expiresAt,
            ipAddress,
            userAgent: JSON.stringify(userAgent),
            jti,
            deviceOwnershipId,
            loginAt,
            loginFrom,
            loginWith,
        });
    }

    async deleteSessionByToken(token: string): Promise<void> {
        const context = await this.betterAuthService.instance.$context;
        await context.internalAdapter.deleteSession(token);
    }

    async findSessionByToken(token: string): Promise<{
        session: Record<string, unknown> & IAuthBetterSessionData;
        user: Record<string, unknown> & { id: string };
    } | null> {
        const context = await this.betterAuthService.instance.$context;
        return context.internalAdapter.findSession(token);
    }
}
