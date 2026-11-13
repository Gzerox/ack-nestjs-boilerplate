import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when an object key collides with an existing key prefix.
 * @public
 */
export class StorageObjectConflictException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.objectConflict;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.CONFLICT;

    constructor() {
        super('storage.error.objectConflict');
    }
}
