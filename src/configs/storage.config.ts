import { registerAs } from '@nestjs/config';
import ms from 'ms';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';

export interface IConfigStorage {
    driver: EnumStorageDriver;
    publicBaseUrl: string;
    local: {
        rootPath: string | null;
        signingKeys: string[];
        publicUrlPattern: string;
        signedUrlPattern: string;
    };
    s3: {
        endpoint: string | null;
        region: string | null;
        accessKeyId: string | null;
        secretAccessKey: string | null;
        forcePathStyle: boolean;
        publicBucket: string | null;
        privateBucket: string | null;
        requestTimeoutInMs: number;
        maxAttempts: number;
    };
    signedUpload: {
        expiresInMs: number;
    };
    signedDownload: {
        expiresInMs: number;
    };
    probeTimeoutInMs: number;
}

export default registerAs('storage', (): IConfigStorage => ({
    driver:
        EnumStorageDriver[process.env.STORAGE_DRIVER as EnumStorageDriver] ??
        EnumStorageDriver.local,
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL!,
    local: {
        rootPath: process.env.STORAGE_LOCAL_ROOT || null,
        signingKeys: (process.env.STORAGE_LOCAL_SIGNING_KEYS ?? '')
            .split(',')
            .map(key => key.trim())
            .filter(key => key.length > 0),
        publicUrlPattern: '{baseUrl}{globalPrefix}/storage/public',
        signedUrlPattern: '{baseUrl}{globalPrefix}/storage/private',
    },
    s3: {
        endpoint: process.env.STORAGE_S3_ENDPOINT || null,
        region: process.env.STORAGE_S3_REGION || null,
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || null,
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || null,
        forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
        publicBucket: process.env.STORAGE_S3_PUBLIC_BUCKET || null,
        privateBucket: process.env.STORAGE_S3_PRIVATE_BUCKET || null,
        requestTimeoutInMs: ms('30s'),
        maxAttempts: 3,
    },
    signedUpload: {
        expiresInMs: ms('10m'),
    },
    signedDownload: {
        expiresInMs: ms('5m'),
    },
    probeTimeoutInMs: ms('3s'),
}));
