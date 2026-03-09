import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { HelperService } from '@common/helper/services/helper.service';
import { FileService } from '@common/file/services/file.service';
import { IAssetCreateOptions } from '@common/asset/interfaces/asset.interface';
import {
    AssetDefaultPath,
    AssetRandomLength,
} from '@common/asset/constants/asset.constant';

@Injectable()
export class AssetUtil {
    constructor(
        private readonly helperService: HelperService,
        private readonly fileService: FileService
    ) {}

    generateChecksum(buffer: Buffer): string {
        return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    }

    createStorageKey(
        originalName: string,
        options?: Pick<IAssetCreateOptions, 'path' | 'prefix'>
    ): string {
        const extension =
            this.fileService.extractExtensionFromFilename(originalName) ||
            'unknown';

        const normalizedPath = (options?.path?.trim() || AssetDefaultPath)
            .replaceAll(/\/+/g, '/')
            .replaceAll(/^\/+|\/+$/g, '');

        const normalizedPrefix = (options?.prefix?.trim() || '').replaceAll(
            /\s+/g,
            '-'
        );

        const token = this.helperService.randomString(AssetRandomLength);
        const filename = normalizedPrefix
            ? `${normalizedPrefix}-${token}.${extension}`
            : `${token}.${extension}`;

        return `${normalizedPath}/${filename}`;
    }
}
