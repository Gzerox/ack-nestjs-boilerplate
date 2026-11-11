import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when no stored object exists at the requested key.
 * @public
 */
export class StorageObjectNotFoundException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.objectNotFound;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.NOT_FOUND;

    constructor() {
        super('storage.error.objectNotFound');
    }
}
