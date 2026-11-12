import { z } from 'zod';

/**
 * Response shape of a term policy content download: the stable public URL of the stored content.
 * @public
 */
export const TermPolicyContentDownloadResponseSchema = z.object({
    url: z.string().meta({
        description: 'Public URL the term policy content is downloaded from',
        example:
            'https://cdn.example.com/term-policies/privacy/v1/en/content.hbs',
    }),
});

/**
 * Term policy content download as it reaches the wire.
 * @public
 */
export type TermPolicyContentDownloadResponseDto = z.infer<
    typeof TermPolicyContentDownloadResponseSchema
>;
