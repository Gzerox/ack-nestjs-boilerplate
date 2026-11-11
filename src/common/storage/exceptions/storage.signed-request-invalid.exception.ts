import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when a signed storage URL is missing, tampered with, expired, or used with another method.
 * @public
 */
export class StorageSignedRequestInvalidException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.signedRequestInvalid;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.FORBIDDEN;

    constructor() {
        super('storage.error.signedRequestInvalid');
    }
}
