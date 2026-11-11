import { z } from 'zod';
import { EnumAppEnvironment } from '@app/enums/app.enum';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { EnumRequestTimezone } from '@common/request/enums/request.enum';
import { EnumLoggerLevel } from '@common/logger/enums/logger.enum';
import { RequestBooleanStringSchema } from '@common/request/validations/request.boolean-string.validation';
import { RequestEncryptionSecretSchema } from '@common/request/validations/request.encryption-secret.validation';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';

/**
 * Validated shape of all application environment variables.
 * @public
 */
export const AppEnvSchema = z
    .object({
        APP_NAME: z.string().min(1),
        APP_ENV: z.enum(EnumAppEnvironment),
        APP_LANGUAGE: z.enum(EnumMessageLanguage),
        APP_ENCRYPTION_SECRET_KEY: RequestEncryptionSecretSchema,
        APP_TIMEZONE: z.enum(EnumRequestTimezone),

        EMAIL_NO_REPLY: z.email().optional(),
        EMAIL_SUPPORT: z.email().optional(),
        EMAIL_ADMIN: z.email().optional(),

        HOME_NAME: z.string().min(1),
        HOME_URL: z.string().min(1),

        HTTP_HOST: z.string().min(1),
        HTTP_PORT: z.coerce.number().int(),
        HTTP_TRUSTED_PROXY: z.string().optional(),

        LOGGER_ENABLE: RequestBooleanStringSchema,
        LOGGER_LEVEL: z.enum(EnumLoggerLevel),
        LOGGER_INTO_FILE: RequestBooleanStringSchema,
        LOGGER_PRETTIER: RequestBooleanStringSchema,
        LOGGER_AUTO: RequestBooleanStringSchema,

        CORS_ALLOWED_ORIGIN: z.string().min(1),

        URL_VERSIONING_ENABLE: RequestBooleanStringSchema,
        URL_VERSION: z.coerce.number().int().min(1),

        DATABASE_URL: z.string().min(1),
        DATABASE_DEBUG: RequestBooleanStringSchema,

        AUTH_JWT_AUDIENCE: z.string().min(1),
        AUTH_JWT_ISSUER: z.string().min(1),
        AUTH_JWT_ACCESS_TOKEN_JWKS_URI: z.string().min(1),
        AUTH_JWT_ACCESS_TOKEN_KID: z.string().min(1),
        AUTH_JWT_ACCESS_TOKEN_PRIVATE_KEY: z.string().min(1),
        AUTH_JWT_ACCESS_TOKEN_PUBLIC_KEY: z.string().min(1),
        AUTH_JWT_ACCESS_TOKEN_EXPIRED: z
            .string()
            .min(1)
            .regex(/^\d+[smhd]$/),
        AUTH_JWT_REFRESH_TOKEN_JWKS_URI: z.string().min(1),
        AUTH_JWT_REFRESH_TOKEN_KID: z.string().min(1),
        AUTH_JWT_REFRESH_TOKEN_PRIVATE_KEY: z.string().min(1),
        AUTH_JWT_REFRESH_TOKEN_PUBLIC_KEY: z.string().min(1),
        AUTH_JWT_REFRESH_TOKEN_EXPIRED: z
            .string()
            .min(1)
            .regex(/^\d+[smhd]$/),

        AUTH_TWO_FACTOR_ISSUER: z.string().min(1),
        AUTH_TWO_FACTOR_ENCRYPTION_KEY: RequestEncryptionSecretSchema,

        AUTH_SOCIAL_GOOGLE_CLIENT_ID: z.string().optional(),
        AUTH_SOCIAL_GOOGLE_CLIENT_SECRET: z.string().optional(),
        AUTH_SOCIAL_APPLE_CLIENT_ID: z.string().optional(),
        AUTH_SOCIAL_APPLE_SIGN_IN_CLIENT_ID: z.string().optional(),

        AWS_SES_IAM_CREDENTIAL_KEY: z.string().optional(),
        AWS_SES_IAM_CREDENTIAL_SECRET: z.string().optional(),
        AWS_SES_IAM_ARN: z.string().optional(),
        AWS_SES_REGION: z.string().optional(),

        STORAGE_DRIVER: z
            .enum(EnumStorageDriver)
            .default(EnumStorageDriver.local),
        STORAGE_PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }),
        STORAGE_LOCAL_ROOT: z.string().optional(),
        STORAGE_LOCAL_SIGNING_KEYS: z.string().optional(),
        STORAGE_S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
        STORAGE_S3_REGION: z.string().optional(),
        STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
        STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
        STORAGE_S3_FORCE_PATH_STYLE: RequestBooleanStringSchema.optional(),
        STORAGE_S3_PUBLIC_BUCKET: z.string().optional(),
        STORAGE_S3_PRIVATE_BUCKET: z.string().optional(),

        CACHE_REDIS_URL: z.string().min(1),
        QUEUE_REDIS_URL: z.string().min(1),

        SENTRY_DSN: z.string().optional(),

        FIREBASE_PROJECT_ID: z.string().optional(),
        FIREBASE_CLIENT_EMAIL: z.string().optional(),
        FIREBASE_PRIVATE_KEY: z.string().optional(),
    })
    .superRefine((env, ctx) => {
        if (env.STORAGE_DRIVER === EnumStorageDriver.local) {
            if (!env.STORAGE_LOCAL_ROOT) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['STORAGE_LOCAL_ROOT'],
                    message:
                        'STORAGE_LOCAL_ROOT is required when STORAGE_DRIVER is local',
                });
            }

            const signingKeys = (env.STORAGE_LOCAL_SIGNING_KEYS ?? '')
                .split(',')
                .map(key => key.trim())
                .filter(key => key.length > 0);
            if (
                signingKeys.length === 0 ||
                signingKeys.some(key => key.length < 32)
            ) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['STORAGE_LOCAL_SIGNING_KEYS'],
                    message:
                        'STORAGE_LOCAL_SIGNING_KEYS needs at least one comma-separated key, each of at least 32 characters',
                });
            }
        }

        if (env.STORAGE_DRIVER === EnumStorageDriver.s3) {
            const required = [
                'STORAGE_S3_REGION',
                'STORAGE_S3_ACCESS_KEY_ID',
                'STORAGE_S3_SECRET_ACCESS_KEY',
                'STORAGE_S3_PUBLIC_BUCKET',
                'STORAGE_S3_PRIVATE_BUCKET',
            ] as const;
            for (const key of required) {
                if (!env[key]) {
                    ctx.addIssue({
                        code: 'custom',
                        path: [key],
                        message: `${key} is required when STORAGE_DRIVER is s3`,
                    });
                }
            }

            if (
                env.STORAGE_S3_ENDPOINT &&
                env.STORAGE_S3_REGION &&
                env.STORAGE_S3_REGION !== 'auto' &&
                new URL(env.STORAGE_S3_ENDPOINT).hostname.endsWith(
                    '.r2.cloudflarestorage.com'
                )
            ) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['STORAGE_S3_REGION'],
                    message:
                        'STORAGE_S3_REGION must be auto for a Cloudflare R2 endpoint',
                });
            }
        }

        if (
            (env.AWS_SES_IAM_CREDENTIAL_KEY ??
                env.AWS_SES_IAM_CREDENTIAL_SECRET) &&
            !env.AWS_SES_IAM_ARN
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['AWS_SES_IAM_ARN'],
                message:
                    'AWS_SES_IAM_ARN is required when an AWS SES IAM credential is set',
            });
        }
    });

/**
 * Validated application environment variables, inferred from `AppEnvSchema`.
 * @public
 */
export type AppEnvDto = z.infer<typeof AppEnvSchema>;
