import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { LocalDisk, S3Disk } from '@nestjs/storage';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { StorageDiskFactory } from '@common/storage/factories/storage.disk.factory';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';

vi.mock('@nestjs/storage', async importOriginal => ({
    ...(await importOriginal<typeof import('@nestjs/storage')>()),
    LocalDisk: vi.fn(),
    S3Disk: vi.fn(),
}));

describe('StorageDiskFactory', () => {
    const configService: MockProxy<ConfigService> = mock<ConfigService>();
    const configGet = vi.mocked(configService.get);
    const helperStringService: MockProxy<HelperStringService> =
        mock<HelperStringService>();
    let factory: StorageDiskFactory;

    const baseConfig: Record<string, unknown> = {
        'app.globalPrefix': '/api',
        'storage.publicBaseUrl': 'http://localhost:3000',
        'storage.local.rootPath': './storage-data',
        'storage.local.signingKeys': [
            'local-signing-key-0123456789abcdefghij',
            'local-signing-key-previous-0123456789',
        ],
        'storage.local.publicUrlPattern':
            '{baseUrl}{globalPrefix}/storage/public',
        'storage.local.signedUrlPattern':
            '{baseUrl}{globalPrefix}/storage/private',
        'storage.local.signedUploadUrlPattern':
            '{baseUrl}{globalPrefix}/storage/upload',
        'storage.s3.endpoint': null,
        'storage.s3.region': 'ap-southeast-3',
        'storage.s3.accessKeyId': 'access-key-id',
        'storage.s3.secretAccessKey': 'secret-access-key',
        'storage.s3.forcePathStyle': false,
        'storage.s3.publicBucket': 'ack-public',
        'storage.s3.privateBucket': 'ack-private',
        'storage.s3.requestTimeoutInMs': 30000,
        'storage.s3.maxAttempts': 3,
    };

    const useConfig = (overrides: Record<string, unknown>): void => {
        const config = { ...baseConfig, ...overrides };
        configGet.mockImplementation((key: string | symbol) =>
            typeof key === 'string' ? config[key] : undefined
        );
    };

    beforeEach(async () => {
        vi.resetAllMocks();

        helperStringService.fillPattern.mockImplementation(
            (pattern: string, values: Record<string, string>) =>
                pattern
                    .replace('{baseUrl}', () => values.baseUrl)
                    .replace('{globalPrefix}', () => values.globalPrefix)
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageDiskFactory,
                { provide: ConfigService, useValue: configService },
                { provide: HelperStringService, useValue: helperStringService },
            ],
        }).compile();

        factory = module.get(StorageDiskFactory);
    });

    describe('createStorageOptions', () => {
        it('builds two local disks under the root, the private one signing with every configured key', () => {
            useConfig({ 'storage.driver': EnumStorageDriver.local });

            const result = factory.createStorageOptions();

            expect(LocalDisk).toHaveBeenCalledTimes(2);
            expect(LocalDisk).toHaveBeenCalledWith({
                root: 'storage-data/public',
                publicUrl: 'http://localhost:3000/api/storage/public',
                signedUrls: {
                    baseUrl: 'http://localhost:3000/api/storage/upload',
                    keys: baseConfig['storage.local.signingKeys'],
                },
            });
            expect(LocalDisk).toHaveBeenCalledWith({
                root: 'storage-data/private',
                signedUrls: {
                    baseUrl: 'http://localhost:3000/api/storage/private',
                    keys: [
                        'local-signing-key-0123456789abcdefghij',
                        'local-signing-key-previous-0123456789',
                    ],
                },
            });
            expect(S3Disk).not.toHaveBeenCalled();
            expect(result.default).toBe(EnumStorageVisibility.private);
            expect(Object.keys(result.disks ?? {}).sort()).toEqual([
                EnumStorageVisibility.private,
                EnumStorageVisibility.public,
            ]);
        });

        it('builds two S3 disks with explicit credentials and the public URL on the public bucket only', () => {
            useConfig({ 'storage.driver': EnumStorageDriver.s3 });

            factory.createStorageOptions();

            const common = {
                region: 'ap-southeast-3',
                endpoint: undefined,
                forcePathStyle: false,
                credentials: {
                    accessKeyId: 'access-key-id',
                    secretAccessKey: 'secret-access-key',
                },
                timeout: 30000,
                retry: 3,
            };
            expect(S3Disk).toHaveBeenCalledTimes(2);
            expect(S3Disk).toHaveBeenCalledWith({
                ...common,
                bucket: 'ack-public',
                publicUrl: 'http://localhost:3000',
            });
            expect(S3Disk).toHaveBeenCalledWith({
                ...common,
                bucket: 'ack-private',
            });
            expect(LocalDisk).not.toHaveBeenCalled();
        });

        it('passes the endpoint, region and path style through for an S3-compatible store', () => {
            useConfig({
                'storage.driver': EnumStorageDriver.s3,
                'storage.s3.endpoint':
                    'https://account-id.r2.cloudflarestorage.com',
                'storage.s3.region': 'auto',
                'storage.s3.forcePathStyle': true,
            });

            factory.createStorageOptions();

            expect(S3Disk).toHaveBeenCalledWith(
                expect.objectContaining({
                    bucket: 'ack-private',
                    endpoint: 'https://account-id.r2.cloudflarestorage.com',
                    region: 'auto',
                    forcePathStyle: true,
                })
            );
        });
    });
});
