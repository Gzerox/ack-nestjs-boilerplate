import { StorageSignedUploadResponseSchema } from '@common/storage/dtos/response/storage.signed-upload.response.dto';

describe('StorageSignedUploadResponseSchema', () => {
    const expiresAt = new Date('2026-01-01T00:10:00.000Z');
    const signedUpload = {
        key: 'incoming/users/user-1/profile/upload.png',
        url: 'https://api.example.com/api/storage/private?signature=abc',
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        expiresAt,
    };

    it('keeps the key, url, method, headers and expiry', () => {
        const result = StorageSignedUploadResponseSchema.parse({
            ...signedUpload,
            bucket: 'ack-private',
        });

        expect(result).toEqual(signedUpload);
    });

    it('rejects a method other than PUT', () => {
        const result = StorageSignedUploadResponseSchema.safeParse({
            ...signedUpload,
            method: 'POST',
        });

        expect(result.success).toBe(false);
    });

    it('requires the headers record', () => {
        const { headers: _headers, ...withoutHeaders } = signedUpload;

        const result =
            StorageSignedUploadResponseSchema.safeParse(withoutHeaders);

        expect(result.success).toBe(false);
    });

    it('rejects a header value that is not a string', () => {
        const result = StorageSignedUploadResponseSchema.safeParse({
            ...signedUpload,
            headers: { 'content-length': 10 },
        });

        expect(result.success).toBe(false);
    });
});
