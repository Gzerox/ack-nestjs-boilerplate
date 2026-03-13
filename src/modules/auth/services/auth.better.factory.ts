import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { bearer } from 'better-auth/plugins/bearer';
import { jwt } from 'better-auth/plugins/jwt';
import { PrismaClient } from '@prisma/client';
import ms from 'ms';
import ObjectID from 'bson-objectid';

function createBetterAuthInstance() {
    const host = process.env.HTTP_HOST ?? 'localhost';
    const port = +(process.env.HTTP_PORT ?? 3000);
    const globalPrefix = '/api';
    const accessExpiry =
        ms(process.env.AUTH_JWT_ACCESS_TOKEN_EXPIRED as ms.StringValue) / 1000;
    const refreshExpiry =
        ms(process.env.AUTH_JWT_REFRESH_TOKEN_EXPIRED as ms.StringValue) / 1000;
    const alg = 'ES256' as const;

    const prisma = new PrismaClient();

    return betterAuth({
        baseURL: `http://${host}:${port}`,
        basePath: `${globalPrefix}/auth`,
        secret: process.env.APP_ENCRYPTION_SECRET_KEY,
        database: prismaAdapter(prisma, { provider: 'mongodb' }),
        advanced: {
            database: { generateId: () => new ObjectID().toHexString() },
        },
        user: {
            modelName: 'User',
            fields: { emailVerified: 'isVerified' },
        },
        session: {
            modelName: 'Session',
            expiresIn: refreshExpiry,
            additionalFields: {
                jti: { type: 'string' as const, required: false },
                deviceOwnershipId: { type: 'string' as const, required: false },
                loginAt: { type: 'date' as const, required: false },
                loginFrom: { type: 'string' as const, required: false },
                loginWith: { type: 'string' as const, required: false },
            },
        },
        account: { modelName: 'AuthAccount' },
        verification: { modelName: 'AuthVerification' },
        rateLimit: { enabled: false },
        plugins: [
            bearer(),
            jwt({
                jwt: {
                    issuer: process.env.AUTH_JWT_ISSUER,
                    audience: process.env.AUTH_JWT_AUDIENCE,
                    expirationTime: accessExpiry,
                },
                jwks: { keyPairConfig: { alg } },
                schema: { jwks: { modelName: 'Jwk' } },
            }),
        ],
    });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;
export const betterAuthInstance = createBetterAuthInstance();
