import { z } from 'zod';
import {
    StorageObjectKeyMaxLength,
    StorageObjectKeyRegex,
    StorageObjectKeyStructureInvalidRegex,
} from '@common/storage/constants/storage.constant';

/**
 * Validates the completion of a signed upload: the staging key the signed upload returned, and nothing else.
 * @public
 */
export const StorageSignedUploadCompleteRequestSchema = z.strictObject({
    key: z
        .string()
        .min(1)
        .max(StorageObjectKeyMaxLength)
        .regex(StorageObjectKeyRegex)
        .refine(key => !StorageObjectKeyStructureInvalidRegex.test(key))
        .meta({
            description: 'Staging key returned by the signed upload',
            example:
                'incoming/users/0199a7a4-7c1e-7cc3-9d6e-4a6b2f1f0c11/profile/0199a7a4-8f2d-7a10-b3c5-1d2e3f4a5b6c.jpg',
        }),
});

/**
 * Completion of a signed upload.
 * @public
 */
export type StorageSignedUploadCompleteRequestDto = z.infer<
    typeof StorageSignedUploadCompleteRequestSchema
>;
