import { Injectable } from '@nestjs/common';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { LoginTicket, OAuth2Client, TokenPayload } from 'google-auth-library';
import {
    IAuthAccessTokenGenerate,
    IAuthJwtAccessTokenPayload,
    IAuthJwtOptions,
    IAuthPassword,
    IAuthPasswordOptions,
    IAuthRefreshTokenGenerate,
    IAuthSocialPayload,
} from '@modules/auth/interfaces/auth.interface';
import { HelperService } from '@common/helper/services/helper.service';
import {
    EnumUserLoginFrom,
    EnumUserLoginWith,
    PasswordHistory,
    User,
} from '@generated/prisma-client';
import verifyAppleToken, {
    VerifyAppleIdTokenResponse,
} from 'verify-apple-id-token';
import { IRequestApp } from '@common/request/interfaces/request.interface';
import { IUser } from '@modules/user/interfaces/user.interface';
import { AuthTokenResponseDto } from '@modules/auth/dtos/response/auth.token.response.dto';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuthInstance } from '@modules/auth/services/auth.better.factory';

export function validatePassword(password: string, hash: string): boolean {
    return compareSync(password, hash);
}

export function hashPassword(password: string, saltLength: number): string {
    const salt = genSaltSync(saltLength);
    return hashSync(password, salt);
}

/**
 * Authentication Utility Service.
 * Handles JWT tokens, password operations, and social authentication (Google, Apple).
 * See documentation: docs/authentication.md
 */
@Injectable()
export class AuthUtil {
    readonly jwtAccessTokenExpirationTimeInSeconds: number;
    readonly jwtRefreshTokenExpirationTimeInSeconds: number;

    private readonly jwtPrefix: string;
    private readonly jwtHeader: string;

    // apple
    private readonly appleHeader: string;
    private readonly applePrefix: string;

    // google
    private readonly googleHeader: string;
    private readonly googlePrefix: string;

    // password
    private readonly passwordExpiredInSeconds: number;
    private readonly passwordExpiredTemporaryInSeconds: number;
    private readonly passwordSaltLength: number;
    private readonly passwordPeriodInSeconds: number;
    private readonly passwordAttempt: boolean;
    private readonly passwordMaxAttempt: number;

    // apple
    private readonly appleClientId: string;
    private readonly appleSignInClientId: string;

    // google
    private readonly googleClient: OAuth2Client;

    private readonly jwtAudience: string;
    private readonly jwtIssuer: string;

    constructor(
        private readonly helperService: HelperService,
        private readonly betterAuthService: BetterAuthService<BetterAuthInstance>,
        private readonly configService: ConfigService
    ) {
        this.jwtAccessTokenExpirationTimeInSeconds =
            this.configService.get<number>(
                'auth.jwt.accessToken.expirationTimeInSeconds'
            );
        this.jwtRefreshTokenExpirationTimeInSeconds =
            this.configService.get<number>(
                'auth.jwt.refreshToken.expirationTimeInSeconds'
            );

        this.jwtAudience = this.configService.get<string>('auth.jwt.audience');
        this.jwtIssuer = this.configService.get<string>('auth.jwt.issuer');

        this.jwtPrefix = this.configService.get<string>('auth.jwt.prefix');
        this.jwtHeader = this.configService.get<string>('auth.jwt.header');

        this.appleHeader = this.configService.get<string>('auth.apple.header');
        this.applePrefix = this.configService.get<string>('auth.apple.prefix');

        this.googleHeader =
            this.configService.get<string>('auth.google.header');
        this.googlePrefix =
            this.configService.get<string>('auth.google.prefix');

        // password
        this.passwordExpiredInSeconds = this.configService.get<number>(
            'auth.password.expiredInSeconds'
        );
        this.passwordExpiredTemporaryInSeconds = this.configService.get<number>(
            'auth.password.expiredTemporaryInSeconds'
        );
        this.passwordSaltLength = this.configService.get<number>(
            'auth.password.saltLength'
        );
        this.passwordPeriodInSeconds = this.configService.get<number>(
            'auth.password.periodInSeconds'
        );
        this.passwordAttempt = this.configService.get<boolean>(
            'auth.password.attempt'
        );
        this.passwordMaxAttempt = this.configService.get<number>(
            'auth.password.maxAttempt'
        );

        // apple
        this.appleClientId = this.configService.get<string>(
            'auth.apple.clientId'
        );
        this.appleSignInClientId = this.configService.get<string>(
            'auth.apple.signInClientId'
        );

        // google
        this.googleClient = new OAuth2Client(
            this.configService.get<string>('auth.google.clientId'),
            this.configService.get<string>('auth.google.clientSecret')
        );
    }

    /**
     * Creates access token payload from user and login data.
     * @param data - User entity
     * @param sessionId - Session identifier
     * @param loginAt - Login timestamp
     * @param loginFrom - Login source/platform
     * @param loginWith - Authentication method
     * @returns Formatted access token payload
     */
    createPayloadAccessToken(
        data: User,
        sessionId: string,
        deviceOwnershipId: string,
        loginAt: Date,
        loginFrom: EnumUserLoginFrom,
        loginWith: EnumUserLoginWith
    ): IAuthJwtAccessTokenPayload {
        return {
            userId: data.id,
            roleId: data.roleId,
            username: data.username,
            email: data.email,
            sessionId,
            deviceOwnershipId,
            loginAt,
            loginFrom,
            loginWith,
        };
    }

    /**
     * Validates password against bcrypt hash.
     * @param passwordString - Plain text password
     * @param passwordHash - Bcrypt hash to compare
     * @returns True if password matches
     */
    validatePassword(passwordString: string, passwordHash: string): boolean {
        return validatePassword(passwordString, passwordHash);
    }

    /**
     * Checks if user exceeded maximum password attempt limit.
     * @param user - User entity
     * @returns True if attempts exceeded limit
     */
    checkPasswordAttempt(user: User): boolean {
        return this.passwordAttempt
            ? user.passwordAttempt >= this.passwordMaxAttempt
            : false;
    }

    /**
     * Creates password hash with salt and expiration tracking.
     * @param userId - User identifier
     * @param password - Plain text password
     * @param options - Optional settings (temporary flag)
     * @returns Password object with hash, expiration, and encrypted password
     */
    createPassword(
        userId: string,
        password: string,
        options?: IAuthPasswordOptions
    ): IAuthPassword {
        const today = this.helperService.dateCreate();
        const salt: string = this.helperService.bcryptGenerateSalt(
            this.passwordSaltLength
        );
        const passwordExpired: Date = this.helperService.dateForward(
            today,
            this.helperService.dateCreateDuration({
                seconds: options?.temporary
                    ? this.passwordExpiredTemporaryInSeconds
                    : this.passwordExpiredInSeconds,
            })
        );
        const passwordHash = this.helperService.bcryptHash(password, salt);
        const passwordPeriodExpired: Date = this.helperService.dateForward(
            today,
            this.helperService.dateCreateDuration({
                seconds: this.passwordPeriodInSeconds,
            })
        );
        const passwordEncrypted: string = this.encryptPassword(
            userId,
            password
        );

        return {
            passwordHash,
            passwordExpired,
            passwordCreated: today,
            passwordPeriodExpired,
            passwordEncrypted,
        };
    }

    /**
     * Encrypts password using AES-256 encryption with user ID as key.
     * Used for emergency password storage/recovery purposes.
     * @param userId - User identifier used as encryption key
     * @param password - Plain text password to encrypt
     * @returns AES-256 encrypted password
     */
    encryptPassword(userId: string, password: string): string {
        return this.helperService.aes256EncryptSimple(password, userId);
    }

    /**
     * Decrypts password using AES-256 decryption with user ID as key.
     * @param userId - User identifier used as decryption key
     * @param encrypted - AES-256 encrypted password
     * @returns Decrypted plain text password
     */
    decryptPassword(userId: string, encrypted: string): string {
        return this.helperService.aes256DecryptSimple(encrypted, userId);
    }

    /**
     * Generates a random 10-character alphanumeric password string.
     * @returns Random password
     */
    createPasswordRandom(): string {
        return this.helperService.randomString(10);
    }

    /**
     * Checks if password has expired.
     * @param passwordExpired - Optional password expiration date
     * @returns True if password expired
     */
    checkPasswordExpired(passwordExpired?: Date): boolean {
        if (!passwordExpired) {
            return false;
        }

        const today: Date = this.helperService.dateCreate();
        return today > passwordExpired;
    }

    /**
     * Extracts Google OAuth token from request headers.
     * @param request - HTTP request with Google OAuth headers
     * @returns Header split by prefix or empty array
     */
    extractHeaderGoogle(request: IRequestApp<IAuthSocialPayload>): string[] {
        return (
            (
                request.headers[`${this.googleHeader?.toLowerCase()}`] as string
            )?.split(`${this.googlePrefix} `) ?? []
        );
    }

    /**
     * Verifies Google OAuth ID token.
     * @param token - Google OAuth ID token
     * @returns Promise resolving to verified token payload
     */
    async verifyGoogle(token: string): Promise<TokenPayload> {
        const login: LoginTicket = await this.googleClient.verifyIdToken({
            idToken: token,
        });

        const payload: TokenPayload = login.getPayload();

        return payload;
    }

    /**
     * Extracts Apple Sign-In token from request headers.
     * @param request - HTTP request with Apple Sign-In headers
     * @returns Header split by prefix or empty array
     */
    extractHeaderApple(request: IRequestApp<IAuthSocialPayload>): string[] {
        return (
            (
                request.headers[`${this.appleHeader?.toLowerCase()}`] as string
            )?.split(`${this.applePrefix} `) ?? []
        );
    }

    /**
     * Verifies Apple Sign-In ID token.
     * @param token - Apple ID token
     * @returns Promise resolving to verified token response
     */
    async verifyApple(token: string): Promise<VerifyAppleIdTokenResponse> {
        return verifyAppleToken({
            idToken: token,
            clientId: [this.appleClientId, this.appleSignInClientId],
        });
    }

    /**
     * Generates a unique 32-character token identifier for session tracking.
     * @returns Random token identifier
     */
    generateJti(): string {
        return this.helperService.randomString(32);
    }

    /**
     * Extracts JWT token from request headers.
     * @param request - HTTP request with JWT headers
     * @returns Header split by prefix or empty array
     */
    extractHeaderJwt(request: IRequestApp<unknown>): string[] {
        return (
            (
                request.headers[`${this.jwtHeader?.toLowerCase()}`] as string
            )?.split(`${this.jwtPrefix} `) ?? []
        );
    }

    /**
     * Creates access and refresh tokens for user session.
     * @param user - User entity
     * @param loginFrom - Login source/platform
     * @param loginWith - Authentication method
     * @returns Token response with access/refresh tokens, jti, and sessionId
     */
    async createTokens(
        user: IUser,
        {
            sessionId,
            deviceOwnershipId,
            refreshToken,
            jti,
            loginAt,
            loginFrom,
            loginWith,
        }: {
            sessionId: string;
            deviceOwnershipId: string;
            refreshToken: string;
            jti: string;
            loginAt: Date;
            loginFrom: EnumUserLoginFrom;
            loginWith: EnumUserLoginWith;
        }
    ): Promise<IAuthAccessTokenGenerate> {
        const payloadAccessToken: IAuthJwtAccessTokenPayload = {
            ...this.createPayloadAccessToken(
                user,
                sessionId,
                deviceOwnershipId,
                loginAt,
                loginFrom,
                loginWith
            ),
            jti,
        };
        const accessToken = await this.signAccessToken(payloadAccessToken);

        const tokens: AuthTokenResponseDto = {
            tokenType: this.jwtPrefix,
            roleType: user.role.type,
            expiresIn: this.jwtAccessTokenExpirationTimeInSeconds,
            accessToken,
            refreshToken,
        };

        return {
            tokens,
            jti,
            sessionId,
        };
    }

    /**
     * Refreshes access token using valid refresh token.
     * Validates refresh token, extracts session context, and generates new access token.
     * Maintains session continuity while issuing new access token with remaining refresh token validity.
     * @param user - User entity
     * @param refreshTokenFromRequest - Valid refresh token from client
     * @returns New tokens with new JTI, adjusted expiry time, and session metadata
     */
    async refreshToken(
        user: IUser,
        {
            deviceOwnershipId,
            sessionId,
            loginAt,
            loginFrom,
            loginWith,
            refreshToken,
        }: {
            sessionId: string;
            deviceOwnershipId: string;
            loginAt: Date;
            loginFrom: EnumUserLoginFrom;
            loginWith: EnumUserLoginWith;
            refreshToken: string;
        }
    ): Promise<IAuthRefreshTokenGenerate> {
        const jti = this.generateJti();
        const payloadAccessToken: IAuthJwtAccessTokenPayload = {
            ...this.createPayloadAccessToken(
                user,
                sessionId,
                deviceOwnershipId,
                loginAt,
                loginFrom,
                loginWith
            ),
            jti,
        };
        const accessToken = await this.signAccessToken(payloadAccessToken);

        const tokens: AuthTokenResponseDto = {
            tokenType: this.jwtPrefix,
            roleType: user.role.type,
            expiresIn: this.jwtAccessTokenExpirationTimeInSeconds,
            accessToken,
            refreshToken,
        };

        return {
            tokens,
            jti,
            sessionId,
        };
    }

    /**
     * Checks if provided password matches any password in user's history.
     * Used to prevent reusing recent passwords during password change.
     * @param histories - Array of password history records (bcrypt hashed)
     * @param password - Plain text password to check against history
     * @returns Password history record if found, null if password is not in history
     */
    checkPasswordPeriod(
        histories: PasswordHistory[],
        password: string
    ): PasswordHistory | null {
        for (const history of histories) {
            if (this.helperService.bcryptCompare(password, history.password)) {
                return history;
            }
        }

        return null;
    }

    /**
     * Converts password period setting from seconds to days.
     * Used for display/UI purposes (e.g., "Password must not repeat for X days").
     * @returns Password period in days
     */
    getPasswordPeriodInDays(): number {
        return Math.floor(this.passwordPeriodInSeconds / (60 * 60 * 24));
    }

    async signAccessToken(
        payload: IAuthJwtAccessTokenPayload,
        options?: IAuthJwtOptions
    ): Promise<string> {
        const iat = Math.floor(Date.now() / 1000);
        const response = await this.betterAuthService.api.signJWT({
            body: {
                payload: {
                    ...payload,
                    iat,
                    sub: payload.userId,
                },
                overrideOptions: {
                    jwt: {
                        audience: options?.audience ?? this.jwtAudience,
                        issuer: options?.issuer ?? this.jwtIssuer,
                        ...(options?.expirationTime !== undefined && {
                            expirationTime: options.expirationTime,
                        }),
                    },
                },
            },
        });

        return response.token;
    }

    async verifyAccessToken(
        token: string,
        issuer?: string
    ): Promise<IAuthJwtAccessTokenPayload | null> {
        const response = await this.betterAuthService.api.verifyJWT({
            body: {
                token,
                issuer: issuer ?? this.jwtIssuer,
            },
        });

        if (!response.payload) {
            return null;
        }

        return response.payload as unknown as IAuthJwtAccessTokenPayload;
    }
}
