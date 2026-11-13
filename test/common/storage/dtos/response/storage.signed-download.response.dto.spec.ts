import { StorageSignedDownloadResponseSchema } from '@common/storage/dtos/response/storage.signed-download.response.dto';

describe('StorageSignedDownloadResponseSchema', () => {
    const signedDownload = {
        url: 'https://api.example.com/api/storage/private?signature=abc',
        expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    };

    it('keeps the url and expiry and strips undeclared fields', () => {
        const result = StorageSignedDownloadResponseSchema.parse({
            ...signedDownload,
            key: 'term-policies/privacy/v1/en/content.hbs',
        });

        expect(result).toEqual(signedDownload);
    });

    it('requires the expiry', () => {
        const result = StorageSignedDownloadResponseSchema.safeParse({
            url: signedDownload.url,
        });

        expect(result.success).toBe(false);
    });
});
