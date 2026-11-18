import { z } from 'zod';
import { UserAddMobileNumberRequestSchema } from '@modules/user/dtos/request/user.add-mobile-number.request.dto';

/**
 * Validates the body that resends a mobile number verification code; the channel is required.
 * @public
 */
export const UserResendMobileNumberVerificationRequestSchema =
    UserAddMobileNumberRequestSchema.pick({ channel: true });

/**
 * Body for resending a mobile number verification code.
 * @public
 */
export type UserResendMobileNumberVerificationRequestDto = z.infer<
    typeof UserResendMobileNumberVerificationRequestSchema
>;
