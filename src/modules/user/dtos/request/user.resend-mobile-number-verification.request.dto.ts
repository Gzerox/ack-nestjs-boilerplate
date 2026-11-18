import { z } from 'zod';
import { UserAddMobileNumberRequestSchema } from '@modules/user/dtos/request/user.add-mobile-number.request.dto';

/**
 * Validates the body that sends a mobile number verification code; the channel is required.
 * @public
 */
export const UserResendMobileNumberVerificationRequestSchema =
    UserAddMobileNumberRequestSchema.pick({ channel: true });

/**
 * Body for sending a mobile number verification code again.
 * @public
 */
export type UserResendMobileNumberVerificationRequestDto = z.infer<
    typeof UserResendMobileNumberVerificationRequestSchema
>;
