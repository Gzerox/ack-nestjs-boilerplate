import { EnumStorageVisibility } from '@generated/prisma-client/client';

/**
 * Key prefix on the private disk under which every signed direct upload is staged until it is verified.
 * @public
 */
export const StorageIncomingPrefix = 'incoming/';

/**
 * Admits the characters of an object key: letters, digits, dot, underscore, hyphen and `/`. Every character a URL
 * or `String.prototype.replace` treats as structure (`$`, `?`, `#`, `%`) is excluded.
 * @public
 */
export const StorageObjectKeyRegex = /^[A-Za-z0-9_./-]+$/;

/**
 * Matches the key structures no disk accepts: a leading or trailing `/`, an empty segment, and a `.` or `..` segment.
 * @public
 */
export const StorageObjectKeyStructureInvalidRegex =
    /^\/|\/$|\/\/|(?:^|\/)\.{1,2}(?:\/|$)/;

/**
 * Longest object key every disk accepts, in characters.
 * @public
 */
export const StorageObjectKeyMaxLength = 1024;

/**
 * Example stored asset for the OpenAPI document of every response that embeds one.
 * @public
 */
export const StorageAssetExample = {
    key: 'users/0199a7a4-7c1e-7cc3-9d6e-4a6b2f1f0c11/profile/0199a7a4-8f2d-7a10-b3c5-1d2e3f4a5b6c.jpg',
    visibility: EnumStorageVisibility.public,
    contentType: 'image/jpeg',
    url: 'https://cdn.example.com/users/0199a7a4-7c1e-7cc3-9d6e-4a6b2f1f0c11/profile/0199a7a4-8f2d-7a10-b3c5-1d2e3f4a5b6c.jpg',
};

/**
 * Leading bytes of a staged object read to detect its content type, enough for a feature detector of a text format.
 * @public
 */
export const StorageContentTypeSampleBytes = 4096;

/**
 * Keys removed per delete request when a whole prefix is cleared, the S3 `DeleteObjects` maximum.
 * @public
 */
export const StorageDeleteBatchSize = 1000;

/**
 * `Cache-Control` of a public object served by the local driver: keys are random and never reused, so it never changes.
 * @public
 */
export const StoragePublicCacheControl = 'public, max-age=31536000, immutable';

/**
 * `Cross-Origin-Resource-Policy` of a file served by the local driver, so a client on another origin can load it.
 * @public
 */
export const StorageCrossOriginResourcePolicy = 'cross-origin';

/**
 * Request-store key holding the stored asset `StorageUploadInterceptor` wrote for the current request.
 * @public
 */
export const StorageStoredUploadStoreKey = 'StorageStoredUploadStore';

/**
 * Metadata key carrying the `StorageUploadSingle` options of a route.
 * @public
 */
export const StorageUploadOptionsMetaKey = 'StorageUploadOptionsMetaKey';
