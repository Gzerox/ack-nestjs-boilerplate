import { z } from 'zod';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { StorageSignedUploadRequestSchema } from '@common/storage/dtos/request/storage.signed-upload.request.dto';
import { TermPolicyAcceptRequestSchema } from '@modules/term-policy/dtos/request/term-policy.accept.request.dto';

/**
 * Validates the body that requests a signed direct upload of one term policy content.
 * @public
 */
export const TermPolicyContentPresignRequestSchema =
    StorageSignedUploadRequestSchema.extend({
        type: TermPolicyAcceptRequestSchema.shape.type,
        language: z.enum(EnumMessageLanguage).meta({
            description: 'Language of the term document',
            example: EnumMessageLanguage.en,
        }),
        version: z.number().int().meta({
            description: 'Version of the terms policy',
            example: 1,
        }),
    });

/**
 * Body that requests a signed direct upload of one term policy content.
 * @public
 */
export type TermPolicyContentPresignRequestDto = z.infer<
    typeof TermPolicyContentPresignRequestSchema
>;
