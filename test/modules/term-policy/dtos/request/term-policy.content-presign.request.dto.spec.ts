import { EnumTermPolicyType } from '@generated/prisma-client';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { TermPolicyContentPresignRequestSchema } from '@modules/term-policy/dtos/request/term-policy.content-presign.request.dto';
describe('TermPolicyContentPresignRequestSchema', () => {
    const valid = {
        type: EnumTermPolicyType.privacy,
        language: EnumMessageLanguage.en,
        version: 1,
        size: 1,
    };
    it('accepts an integer content presign request', () =>
        expect(TermPolicyContentPresignRequestSchema.parse(valid)).toEqual(
            valid
        ));
    it('leaves the configured maximum to the domain and accepts a large size', () =>
        expect(
            TermPolicyContentPresignRequestSchema.safeParse({
                ...valid,
                size: 104857600,
            }).success
        ).toBe(true));
    it.each([
        { ...valid, version: 1.5 },
        { ...valid, language: 'xx' },
        { ...valid, size: 0 },
        { ...valid, size: 1.5 },
        { ...valid, unknown: true },
    ])('rejects malformed, non-positive or unknown input', input =>
        expect(
            TermPolicyContentPresignRequestSchema.safeParse(input).success
        ).toBe(false)
    );
});
