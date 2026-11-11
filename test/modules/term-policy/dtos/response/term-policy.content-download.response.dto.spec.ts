import { TermPolicyContentDownloadResponseSchema } from '@modules/term-policy/dtos/response/term-policy.content-download.response.dto';

describe('TermPolicyContentDownloadResponseSchema', () => {
    it('keeps a signed URL with its expiry and strips undeclared keys', () => {
        const expiresAt = new Date('2026-01-01T00:05:00.000Z');

        const result = TermPolicyContentDownloadResponseSchema.parse({
            url: 'https://storage.example.com/download?signature=abc',
            expiresAt,
            key: 'term-policies/privacy/v1/en/content.hbs',
        });

        expect(result).toEqual({
            url: 'https://storage.example.com/download?signature=abc',
            expiresAt,
        });
    });

    it('accepts a public URL with no expiry', () => {
        const result = TermPolicyContentDownloadResponseSchema.parse({
            url: 'https://cdn.example.com/term-policies/privacy/v1/en/content.hbs',
            expiresAt: null,
        });

        expect(result.expiresAt).toBeNull();
    });

    it('rejects a missing url', () => {
        expect(
            TermPolicyContentDownloadResponseSchema.safeParse({
                expiresAt: null,
            }).success
        ).toBe(false);
    });
});
