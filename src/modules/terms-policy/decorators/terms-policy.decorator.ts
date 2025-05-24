import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { TermsPolicyAcceptedGuard } from '../guards/terms-policy-accepted.guard';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';

export const TERMS_POLICY_TYPE_META_KEY = 'terms_policy_type';

/**
 * Ensures the authenticated user has accepted the most recent policy of specified type
 * @param policyType The type of policy that must be accepted
 */
export function TermsPolicyAccepted(
    policyType: ENUM_TERMS_POLICY_TYPE
): MethodDecorator {
    return applyDecorators(
        UseGuards(TermsPolicyAcceptedGuard),
        SetMetadata(TERMS_POLICY_TYPE_META_KEY, policyType)
    );
}
