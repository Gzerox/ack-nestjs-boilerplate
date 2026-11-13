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

        if (
            env.STORAGE_DRIVER === EnumStorageDriver.local &&
            !env.STORAGE_LOCAL_ROOT?.trim()
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['STORAGE_LOCAL_ROOT'],
                message:
                    'STORAGE_LOCAL_ROOT is required when STORAGE_DRIVER is local',
            });
        }
    });

/**
 * Validated application environment variables, inferred from `AppEnvSchema`.
 * @public
 */
export type AppEnvDto = z.infer<typeof AppEnvSchema>;
