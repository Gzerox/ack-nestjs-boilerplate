import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when an object size differs from the declared size or exceeds the limit.
 * @public
 */
export class StorageSizeInvalidException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.sizeInvalid;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

    constructor() {
        super('storage.error.sizeInvalid');
    }
}
