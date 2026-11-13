import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';

/**
 * Raised when the object store refuses a request or cannot be reached.
 * @public
 */
export class StorageServiceUnavailableException extends AppBaseException {
    readonly module = 'storage';
    readonly statusCode = EnumStorageStatusCodeError.serviceUnavailable;
    readonly statusCodeKey = EnumStorageStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.SERVICE_UNAVAILABLE;

    constructor(rawError?: unknown) {
        super('storage.error.serviceUnavailable', { rawError });
    }
}
