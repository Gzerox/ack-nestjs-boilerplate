import { z } from 'zod';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { StorageAssetExample } from '@common/storage/constants/storage.constant';

/**
 * Response shape of a stored asset embedded in another response: logical identity, content type and its runtime URL.
 * @public
 */
export const StorageAssetResponseSchema = z.object({
    key: z.string().meta({
        description: 'Object key of the stored asset',
        example: StorageAssetExample.key,
    }),
    visibility: z.enum(EnumStorageVisibility).meta({
        description: 'Visibility of the stored asset',
        example: StorageAssetExample.visibility,
    }),
    contentType: z.string().meta({
        description: 'Content type detected from the stored bytes',
        example: StorageAssetExample.contentType,
    }),
    url: z.string().nullable().meta({
        description:
            'Public URL of a public asset; null for a private asset, which is delivered through a signed download',
        example: StorageAssetExample.url,
    }),
});

/**
 * Stored asset as it reaches the wire.
 * @public
 */
export type StorageAssetResponseDto = z.infer<
    typeof StorageAssetResponseSchema
>;
