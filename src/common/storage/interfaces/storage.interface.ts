import type { EnumStorageVisibility } from '@generated/prisma-client/client';
import type { StorageSignedUpload } from '@nestjs/storage';
import type { EnumFileExtension } from '@common/file/enums/file.enum';

export interface IStoredAsset {
    key: string;
    visibility: EnumStorageVisibility;
    contentType: string;
    size: number;
    etag: string | null;
}

export type IStoredAssetReference = Pick<IStoredAsset, 'key' | 'visibility'>;

export type IStoredAssetSource = Pick<
    IStoredAsset,
    'key' | 'visibility' | 'contentType'
>;

export interface IStorageSignedUpload extends StorageSignedUpload {
    key: string;
}

export interface IStorageSignedDownload {
    url: string;
    expiresAt: Date;
}

export interface IStorageSignedUploadOptions {
    contentType: string;
    size: number;
}

export interface IStorageSignedDownloadOptions {
    filename?: string;
    disposition?: 'attachment' | 'inline';
}

export interface IStorageVerifyRules {
    scopePrefix: string;
    maxSizeInBytes: number;
    contentTypes: readonly string[];
    detect?: (head: Uint8Array) => string | null;
}

export interface IStorageWriteBody {
    body: Buffer;
    contentType: string;
}

export interface IStorageTarget {
    visibility: EnumStorageVisibility;
    scopePrefix: string;
}

export interface IStorageUploadSingleOptions {
    fieldName: string;
    visibility: EnumStorageVisibility;
    scopePrefixPatternConfigKey: string;
    maxSizeInBytesConfigKey: string;
    extensions: readonly EnumFileExtension[];
}
