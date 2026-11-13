import { HttpStatus } from '@nestjs/common';
import { DocResponseError } from '@common/doc/decorators/doc.decorator';
import { EnumTermPolicyType } from '@generated/prisma-client/client';
import { EnumTermPolicyStatusCodeError } from '@modules/term-policy/enums/term-policy.status-code.enum';

/**
 * Route metadata key holding the term-policy types `@TermPolicyAcceptanceProtected` requires.
 * @public
 */
export const TermPolicyRequiredGuardMetaKey = 'TermPolicyRequiredMetaKey';

/**
 * Term-policy acceptance guard error kit for `@TermPolicyAcceptanceProtected`.
 * @public
 */
export const DocTermPolicyErrorResponses = {
    forbidden: DocResponseError(HttpStatus.FORBIDDEN, {
        statusCode: EnumTermPolicyStatusCodeError.requiredInvalid,
        messagePath: 'termPolicy.error.requiredInvalid',
    }),
} as const;

/**
 * Content type of every term-policy content document: a UTF-8 Handlebars template.
 * @public
 */
export const TermPolicyContentType = 'text/x-handlebars-template';

/**
 * File under `src/modules/term-policy/templates` holding the English initial-data template of each policy type.
 * @public
 */
export const TermPolicyTemplateFilenames: Record<EnumTermPolicyType, string> = {
    [EnumTermPolicyType.termsOfService]: 'term-policy.term.en.hbs',
    [EnumTermPolicyType.privacy]: 'term-policy.privacy.en.hbs',
    [EnumTermPolicyType.cookies]: 'term-policy.cookies.en.hbs',
    [EnumTermPolicyType.marketing]: 'term-policy.marketing.en.hbs',
};
