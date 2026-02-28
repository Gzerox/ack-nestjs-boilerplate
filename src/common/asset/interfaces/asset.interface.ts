import { Asset, EnumAssetAccess, EnumAssetStatus } from '@prisma/client';

export type IAsset = Asset;

export interface IAssetUploadInput {
    buffer: Buffer;
    size: number;
    originalName: string;
    mime?: string;
}

export interface IAssetCreateOptions {
    path?: string;
    prefix?: string;
    access?: EnumAssetAccess;
    checksum?: string;
    filename?: string;
}

export interface IAssetCreate {
    storageKey: string;
    bucket: string;
    access: EnumAssetAccess;
    filename: string;
    completedUrl: string;
    cdnUrl?: string;
    mime: string;
    extension: string;
    size: number;
    checksum?: string;
    status: EnumAssetStatus;
    createdBy: string;
    updatedBy?: string;
}

export interface IAssetUpdateMetadata {
    filename?: string;
    checksum?: string;
}

export interface IAssetUpdate {
    filename?: string;
    checksum?: string;
    updatedBy?: string;
    status?: EnumAssetStatus;
    deletedAt?: Date | null;
    deletedBy?: string;
}

export interface IAssetListOptions {
    includeDeleted?: boolean;
}
