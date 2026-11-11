import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDisk, S3Disk } from '@nestjs/storage';
import type {
    S3DiskOptions,
    StorageModuleOptions,
    StorageOptionsFactory,
} from '@nestjs/storage';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import { EnumStorageDriver } from '@common/storage/enums/storage.enum';

/**
 * Builds the named `public` and `private` disks for the configured driver: two directories under the local root,
 * or two S3 (or S3-compatible) buckets with explicit credentials.
 */
@Injectable()
export class StorageDiskFactory implements StorageOptionsFactory {
    constructor(
        private readonly configService: ConfigService,
        private readonly helperStringService: HelperStringService
    ) {}

    private createLocalDisks(): StorageModuleOptions['disks'] {
        const rootPath = this.configService.get<string>(
            'storage.local.rootPath'
        )!;
        const signingKeys = this.configService.get<string[]>(
            'storage.local.signingKeys'
        )!;
        const publicUrlPattern = this.configService.get<string>(
            'storage.local.publicUrlPattern'
        )!;
        const signedUrlPattern = this.configService.get<string>(
            'storage.local.signedUrlPattern'
        )!;
        const baseUrl = this.configService.get<string>(
            'storage.publicBaseUrl'
        )!;
        const globalPrefix =
            this.configService.get<string>('app.globalPrefix')!;

        const publicUrl = this.helperStringService.fillPattern(
            publicUrlPattern,
            { baseUrl, globalPrefix }
        );
        const signedBaseUrl = this.helperStringService.fillPattern(
            signedUrlPattern,
            { baseUrl, globalPrefix }
        );
        const publicRoot = join(rootPath, EnumStorageVisibility.public);
        const privateRoot = join(rootPath, EnumStorageVisibility.private);

        return {
            [EnumStorageVisibility.public]: new LocalDisk({
                root: publicRoot,
                publicUrl,
            }),
            [EnumStorageVisibility.private]: new LocalDisk({
                root: privateRoot,
                signedUrls: { baseUrl: signedBaseUrl, keys: signingKeys },
            }),
        };
    }

    private createS3Disks(): StorageModuleOptions['disks'] {
        const endpoint = this.configService.get<string | null>(
            'storage.s3.endpoint'
        );
        const publicBucket = this.configService.get<string>(
            'storage.s3.publicBucket'
        )!;
        const privateBucket = this.configService.get<string>(
            'storage.s3.privateBucket'
        )!;
        const publicUrl = this.configService.get<string>(
            'storage.publicBaseUrl'
        )!;
        const region = this.configService.get<string>('storage.s3.region')!;
        const forcePathStyle = this.configService.get<boolean>(
            'storage.s3.forcePathStyle'
        )!;
        const accessKeyId = this.configService.get<string>(
            'storage.s3.accessKeyId'
        )!;
        const secretAccessKey = this.configService.get<string>(
            'storage.s3.secretAccessKey'
        )!;
        const timeout = this.configService.get<number>(
            'storage.s3.requestTimeoutInMs'
        )!;
        const retry = this.configService.get<number>('storage.s3.maxAttempts')!;

        const options: Omit<S3DiskOptions, 'bucket'> = {
            region,
            endpoint: endpoint ?? undefined,
            forcePathStyle,
            credentials: { accessKeyId, secretAccessKey },
            timeout,
            retry,
        };

        return {
            [EnumStorageVisibility.public]: new S3Disk({
                ...options,
                bucket: publicBucket,
                publicUrl,
            }),
            [EnumStorageVisibility.private]: new S3Disk({
                ...options,
                bucket: privateBucket,
            }),
        };
    }

    createStorageOptions(): StorageModuleOptions {
        const driver =
            this.configService.get<EnumStorageDriver>('storage.driver')!;

        let disks: StorageModuleOptions['disks'];
        if (driver === EnumStorageDriver.local) {
            disks = this.createLocalDisks();
        } else {
            disks = this.createS3Disks();
        }

        return { default: EnumStorageVisibility.private, disks };
    }
}
