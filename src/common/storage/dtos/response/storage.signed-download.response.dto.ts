import { z } from 'zod';

/**
 * Response shape of a short-lived signed download of a private asset.
 * @public
 */
export const StorageSignedDownloadResponseSchema = z.object({
    url: z.string().meta({
        description: 'Signed URL the private asset is downloaded from',
        example: 'https://storage.example.com/download?signature=abc',
    }),
    expiresAt: z.date().meta({
        description: 'Moment the signed URL stops being accepted',
        example: new Date('2026-01-01T00:05:00.000Z'),
    }),
});

/**
 * Signed download as it reaches the wire.
 * @public
 */
export type StorageSignedDownloadResponseDto = z.infer<
    typeof StorageSignedDownloadResponseSchema
>;
