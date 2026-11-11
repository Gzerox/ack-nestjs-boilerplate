import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when a verified object cannot be copied to its final location.
 * @public
 */
export class StoragePromotionFailedException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.promotionFailed;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

    constructor(rawError?: unknown) {
        super('storage.error.promotionFailed', { rawError });
    }
}
