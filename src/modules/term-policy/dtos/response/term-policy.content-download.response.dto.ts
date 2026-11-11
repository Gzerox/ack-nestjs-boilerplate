import { z } from 'zod';
import { StorageSignedDownloadResponseSchema } from '@common/storage/dtos/response/storage.signed-download.response.dto';

/**
 * Response shape of a term policy content download: a short-lived signed URL for a draft, the stable public URL
 * with no expiry once the policy is published.
 * @public
 */
export const TermPolicyContentDownloadResponseSchema =
    StorageSignedDownloadResponseSchema.extend({
        expiresAt: z
            .date()
            .nullable()
            .meta({
                description:
                    'Moment the signed URL stops being accepted; null for the public URL of a published content',
                example: new Date('2026-01-01T00:05:00.000Z'),
            }),
    });

/**
 * Term policy content download as it reaches the wire.
 * @public
 */
export type TermPolicyContentDownloadResponseDto = z.infer<
    typeof TermPolicyContentDownloadResponseSchema
>;
