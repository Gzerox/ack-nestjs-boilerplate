import { registerAs } from '@nestjs/config';
import bytes from 'bytes';
import ms from 'ms';

export interface IUserConfig {
    usernamePattern: RegExp;
    photo: {
        scopePrefixPattern: string;
        maxSizeInBytes: number;
    };
    maxDataImport: number;
    maxDataExport: number;
    default: {
        role: string;
        country: string;
    };
    onboarding: {
        createTimeoutInMs: number;
        createBulkTimeoutInMs: number;
    };
}

export default registerAs('user', (): IUserConfig => ({
    usernamePattern: /^[a-zA-Z0-9-_]+$/,
    photo: {
        scopePrefixPattern: 'users/{userId}/profile/',
        maxSizeInBytes: bytes('10mb')!,
    },
    maxDataImport: 50,
    maxDataExport: 500,
    default: {
        role: 'user',
        country: 'ID',
    },
    onboarding: {
        createTimeoutInMs: ms('10s'),
        createBulkTimeoutInMs: ms('30s'),
    },
}));
