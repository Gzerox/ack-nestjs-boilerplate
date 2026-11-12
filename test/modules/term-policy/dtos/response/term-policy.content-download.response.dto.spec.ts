import { TermPolicyContentDownloadResponseSchema } from '@modules/term-policy/dtos/response/term-policy.content-download.response.dto';

describe('TermPolicyContentDownloadResponseSchema', () => {
    it('keeps the public URL and strips undeclared keys, expiresAt included', () => {
        const result = TermPolicyContentDownloadResponseSchema.parse({
            url: 'https://cdn.example.com/term-policies/privacy/v1/en/content.hbs',
            expiresAt: new Date('2026-01-01T00:05:00.000Z'),
            key: 'term-policies/privacy/v1/en/content.hbs',
        });

        expect(result).toEqual({
            url: 'https://cdn.example.com/term-policies/privacy/v1/en/content.hbs',
        });
    });

    it('rejects a missing url', () => {
        expect(
            TermPolicyContentDownloadResponseSchema.safeParse({}).success
        ).toBe(false);
    });
});
