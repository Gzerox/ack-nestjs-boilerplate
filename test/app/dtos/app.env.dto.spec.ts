import { AppEnvSchema } from '@app/dtos/app.env.dto';

describe('AppEnvSchema', () => {
    const validEnv = {
        APP_NAME: 'ACK',
        APP_ENV: 'local',
        APP_LANGUAGE: 'en',
        APP_ENCRYPTION_SECRET_KEY:
            '1234567890123456789012345678901234567890123456789012345678901234',
        APP_TIMEZONE: 'Asia/Jakarta',
        HOME_NAME: 'ACK',
        HOME_URL: 'https://example.com',
        HTTP_HOST: 'localhost',
        HTTP_PORT: '3000',
        LOGGER_ENABLE: 'true',
        LOGGER_LEVEL: 'debug',
        LOGGER_INTO_FILE: 'false',
        LOGGER_PRETTIER: 'true',
        LOGGER_AUTO: 'false',
        CORS_ALLOWED_ORIGIN: '*',
        URL_VERSIONING_ENABLE: 'true',
        URL_VERSION: '1',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/ack',
        DATABASE_DEBUG: 'false',
        AUTH_JWT_AUDIENCE: 'ACK',
        AUTH_JWT_ISSUER: 'https://example.com',
        AUTH_JWT_ACCESS_TOKEN_JWKS_URI: 'https://example.com/access/jwks',
        AUTH_JWT_ACCESS_TOKEN_KID: 'access-key',
        AUTH_JWT_ACCESS_TOKEN_PRIVATE_KEY: 'access-private-key',
        AUTH_JWT_ACCESS_TOKEN_PUBLIC_KEY: 'access-public-key',
        AUTH_JWT_ACCESS_TOKEN_EXPIRED: '1h',
        AUTH_JWT_REFRESH_TOKEN_JWKS_URI: 'https://example.com/refreshInTx/jwks',
        AUTH_JWT_REFRESH_TOKEN_KID: 'refreshInTx-key',
        AUTH_JWT_REFRESH_TOKEN_PRIVATE_KEY: 'refreshInTx-private-key',
        AUTH_JWT_REFRESH_TOKEN_PUBLIC_KEY: 'refreshInTx-public-key',
        AUTH_JWT_REFRESH_TOKEN_EXPIRED: '30d',
        AUTH_TWO_FACTOR_ISSUER: 'ACK',
        AUTH_TWO_FACTOR_ENCRYPTION_KEY:
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-',
        CACHE_REDIS_URL: 'redis://localhost:6379/0',
        QUEUE_REDIS_URL: 'redis://localhost:6379/1',
        STORAGE_PUBLIC_BASE_URL: 'http://localhost:3000',
        STORAGE_LOCAL_ROOT: './storage-data',
        STORAGE_LOCAL_SIGNING_KEYS: 'local-signing-key-0123456789abcdefghij',
    } as const;

    const validS3Env = {
        ...validEnv,
        STORAGE_DRIVER: 's3',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
        STORAGE_LOCAL_ROOT: undefined,
        STORAGE_LOCAL_SIGNING_KEYS: undefined,
        STORAGE_S3_REGION: 'ap-southeast-3',
        STORAGE_S3_ACCESS_KEY_ID: 'access-key-id',
        STORAGE_S3_SECRET_ACCESS_KEY: 'secret-access-key',
        STORAGE_S3_PUBLIC_BUCKET: 'ack-public',
        STORAGE_S3_PRIVATE_BUCKET: 'ack-private',
    } as const;

    const issuePaths = (env: Record<string, unknown>): string[] => {
        const result = AppEnvSchema.safeParse(env);

        return result.success
            ? []
            : result.error.issues.map(issue => issue.path.join('.'));
    };

    it('coerces numeric and exact boolean environment values', () => {
        const result = AppEnvSchema.parse(validEnv);

        expect(result).toMatchObject({
            HTTP_PORT: 3000,
            URL_VERSION: 1,
            LOGGER_ENABLE: true,
            LOGGER_INTO_FILE: false,
            LOGGER_PRETTIER: true,
            LOGGER_AUTO: false,
            URL_VERSIONING_ENABLE: true,
            DATABASE_DEBUG: false,
        });
    });

    it('rejects boolean values with non-exact casing', () => {
        const result = AppEnvSchema.safeParse({
            ...validEnv,
            LOGGER_ENABLE: 'TRUE',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ path: ['LOGGER_ENABLE'] }),
                ])
            );
        }
    });

    it('accepts blank optional integration values without requiring them', () => {
        const result = AppEnvSchema.parse({
            ...validEnv,
            AWS_SES_IAM_ARN: '',
        });

        expect(result.AWS_SES_IAM_ARN).toBe('');
    });

    it('carries no AWS S3 variable and needs no AWS S3 ARN', () => {
        const result = AppEnvSchema.safeParse({
            ...validEnv,
            AWS_S3_IAM_CREDENTIAL_KEY: 'credential',
            AWS_S3_PUBLIC_BUCKET: 'bucket',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('AWS_S3_IAM_CREDENTIAL_KEY');
            expect(result.data).not.toHaveProperty('AWS_S3_PUBLIC_BUCKET');
        }
    });

    it.each([['AWS_SES_IAM_CREDENTIAL_SECRET', 'AWS_SES_IAM_ARN']] as const)(
        'requires %s to be paired with %s',
        (credentialKey, arnKey) => {
            const result = AppEnvSchema.safeParse({
                ...validEnv,
                [credentialKey]: 'credential',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ path: [arnKey] }),
                    ])
                );
            }
        }
    );

    describe('storage', () => {
        it('defaults the storage driver to local', () => {
            const result = AppEnvSchema.parse(validEnv);

            expect(result.STORAGE_DRIVER).toBe('local');
        });

        it('accepts a complete local configuration', () => {
            expect(issuePaths(validEnv)).toEqual([]);
        });

        it('rejects a public base URL that is not absolute', () => {
            expect(
                issuePaths({ ...validEnv, STORAGE_PUBLIC_BASE_URL: '/files' })
            ).toEqual(['STORAGE_PUBLIC_BASE_URL']);
        });

        it.each(['production', 'staging'] as const)(
            'accepts a complete local driver configuration when APP_ENV is %s',
            appEnv => {
                expect(
                    issuePaths({
                        ...validEnv,
                        APP_ENV: appEnv,
                        STORAGE_DRIVER: 'local',
                    })
                ).toEqual([]);
            }
        );

        it('accepts a complete S3 configuration', () => {
            expect(issuePaths(validS3Env)).toEqual([]);
        });

        it('accepts a complete S3 configuration in production', () => {
            expect(
                issuePaths({ ...validS3Env, APP_ENV: 'production' })
            ).toEqual([]);
        });

        it('requires the public base URL when the driver is s3', () => {
            expect(
                issuePaths({
                    ...validS3Env,
                    STORAGE_PUBLIC_BASE_URL: undefined,
                })
            ).toEqual(['STORAGE_PUBLIC_BASE_URL']);
        });

        it('accepts a complete R2 configuration', () => {
            expect(
                issuePaths({
                    ...validS3Env,
                    STORAGE_S3_ENDPOINT:
                        'https://account-id.r2.cloudflarestorage.com',
                    STORAGE_S3_REGION: 'auto',
                })
            ).toEqual([]);
        });

        it('accepts a configured region for a Cloudflare R2 endpoint', () => {
            expect(
                issuePaths({
                    ...validS3Env,
                    STORAGE_S3_ENDPOINT:
                        'https://account-id.r2.cloudflarestorage.com',
                    STORAGE_S3_REGION: 'us-east-1',
                })
            ).toEqual([]);
        });

        it('accepts an S3-compatible endpoint with path style', () => {
            const result = AppEnvSchema.parse({
                ...validS3Env,
                STORAGE_S3_ENDPOINT: 'http://localhost:9000',
                STORAGE_S3_FORCE_PATH_STYLE: 'true',
            });

            expect(result.STORAGE_S3_FORCE_PATH_STYLE).toBe(true);
        });

        it('rejects an S3 endpoint that is not an absolute URL', () => {
            expect(
                issuePaths({ ...validS3Env, STORAGE_S3_ENDPOINT: 'minio:9000' })
            ).toEqual(['STORAGE_S3_ENDPOINT']);
        });

        it('rejects an unknown storage driver', () => {
            expect(
                issuePaths({ ...validEnv, STORAGE_DRIVER: 'azure' })
            ).toEqual(['STORAGE_DRIVER']);
        });
    });
});
