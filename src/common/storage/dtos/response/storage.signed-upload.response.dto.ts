import { z } from 'zod';

/**
 * Response shape of a signed direct upload: the client sends `method` to `url` with `headers` exactly.
 * @public
 */
export const StorageSignedUploadResponseSchema = z.object({
    key: z.string().meta({
        description: 'Staging key to send back on completion',
        example:
            'incoming/users/0199a7a4-7c1e-7cc3-9d6e-4a6b2f1f0c11/profile/0199a7a4-8f2d-7a10-b3c5-1d2e3f4a5b6c.jpg',
    }),
    url: z.string().meta({
        description: 'Signed URL the file is uploaded to',
        example: 'https://storage.example.com/upload?signature=abc',
    }),
    method: z.literal('PUT').meta({
        description: 'HTTP method of the upload request',
        example: 'PUT',
    }),
    headers: z.record(z.string(), z.string()).meta({
        description: 'Headers the upload request must send unchanged',
        example: { 'content-type': 'image/jpeg' },
    }),
    expiresAt: z.date().meta({
        description: 'Moment the signed URL stops being accepted',
        example: new Date('2026-01-01T00:10:00.000Z'),
    }),
});

/**
 * Signed direct upload as it reaches the wire.
 * @public
 */
export type StorageSignedUploadResponseDto = z.infer<
    typeof StorageSignedUploadResponseSchema
>;
