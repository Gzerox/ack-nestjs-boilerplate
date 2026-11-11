import type { z } from 'zod';
import { StorageSignedUploadCompleteRequestSchema } from '@common/storage/dtos/request/storage.signed-upload-complete.request.dto';
import { TermPolicyContentPresignRequestSchema } from '@modules/term-policy/dtos/request/term-policy.content-presign.request.dto';

/**
 * Validates the completion of one term policy content upload: its language and the staging key, nothing else.
 * @public
 */
export const TermPolicyContentRequestSchema =
    StorageSignedUploadCompleteRequestSchema.extend({
        language: TermPolicyContentPresignRequestSchema.shape.language,
    });

/**
 * Completion of one term policy content upload.
 * @public
 */
export type TermPolicyContentRequestDto = z.infer<
    typeof TermPolicyContentRequestSchema
>;
