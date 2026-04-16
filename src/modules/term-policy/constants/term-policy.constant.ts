import { EnumTermPolicyType } from '@generated/prisma-client';

export const TermPolicyRequiredGuardMetaKey = 'TermPolicyRequiredMetaKey';

export const TERM_POLICY_USER_FIELD_MAP: Record<EnumTermPolicyType, string> = {
    [EnumTermPolicyType.termsOfService]: 'termsOfServicePolicy',
    [EnumTermPolicyType.privacy]: 'privacyPolicy',
    [EnumTermPolicyType.cookies]: 'cookiesPolicy',
    [EnumTermPolicyType.marketing]: 'marketingPolicy',
};
