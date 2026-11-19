import { UserResendMobileNumberVerificationRequestSchema } from '@modules/user/dtos/request/user.resend-mobile-number-verification.request.dto';

describe('UserResendMobileNumberVerificationRequestSchema', () => {
    it.each(['sms', 'whatsapp'])('accepts %s as the channel', channel => {
        const result = UserResendMobileNumberVerificationRequestSchema.parse({
            channel,
        });

        expect(result).toEqual({ channel });
    });

    it.each([undefined, {}])('rejects the body %j', body => {
        expect(() =>
            UserResendMobileNumberVerificationRequestSchema.parse(body)
        ).toThrow();
    });

    it.each(['telegram', 1, null])('rejects channel %j', channel => {
        expect(() =>
            UserResendMobileNumberVerificationRequestSchema.parse({ channel })
        ).toThrow();
    });

    it('rejects an undeclared key', () => {
        expect(() =>
            UserResendMobileNumberVerificationRequestSchema.parse({
                channel: 'sms',
                username: 'johnSmith123',
            })
        ).toThrow();
    });
});
