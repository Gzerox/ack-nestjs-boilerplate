import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { TermPolicyContentRequestSchema } from '@modules/term-policy/dtos/request/term-policy.content.request.dto';
describe('TermPolicyContentRequestSchema', () => {
    const valid = {
        language: EnumMessageLanguage.en,
        key: 'incoming/term-policies/privacy/v1/en/content.hbs',
    };
    it('accepts a language and the staging key', () =>
        expect(TermPolicyContentRequestSchema.parse(valid)).toEqual(valid));
    it.each([
        { ...valid, key: 'secret?.hbs' },
        { ...valid, key: 'incoming/term-policies/../en.hbs' },
        { ...valid, size: 1 },
        { ...valid, unknown: true },
    ])('rejects a malformed key, a client size or unknown input', input =>
        expect(TermPolicyContentRequestSchema.safeParse(input).success).toBe(
            false
        )
    );
});
