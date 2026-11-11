import { z } from 'zod';

/**
 * Validates the declared size of a signed upload request; a feature narrows `size` with its own maximum.
 * @public
 */
export const StorageSignedUploadRequestSchema = z.strictObject({
    size: z.number().int().min(1).meta({
        description: 'Exact size in bytes of the file the client will upload',
        example: 102400,
    }),
});

/**
 * Declared size of a signed upload request.
 * @public
 */
export type StorageSignedUploadRequestDto = z.infer<
    typeof StorageSignedUploadRequestSchema
>;
