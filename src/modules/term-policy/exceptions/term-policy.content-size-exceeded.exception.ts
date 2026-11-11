import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumTermPolicyStatusCodeError } from '@modules/term-policy/enums/term-policy.status-code.enum';

/**
 * Raised when a term policy content upload declares a size above the configured maximum.
 * @public
 */
export class TermPolicyContentSizeExceededException extends AppBaseException {
    readonly module = 'termPolicy';
    readonly statusCode = EnumTermPolicyStatusCodeError.contentSizeExceeded;
    readonly statusCodeKey = EnumTermPolicyStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.PAYLOAD_TOO_LARGE;

    constructor() {
        super('termPolicy.error.contentSizeExceeded');
    }
}
