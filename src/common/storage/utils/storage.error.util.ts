import { Injectable } from '@nestjs/common';
import {
    StorageBodyLengthError,
    StorageError,
    StorageFileNotFoundError,
    StorageInvalidKeyError,
    StorageKeyConflictError,
    StorageSignedUrlError,
} from '@nestjs/storage';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import { StorageObjectConflictException } from '@common/storage/exceptions/storage.object-conflict.exception';
import { StorageSignedRequestInvalidException } from '@common/storage/exceptions/storage.signed-request-invalid.exception';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';

/**
 * Maps a `@nestjs/storage` error onto the typed `storage` exception a feature may see; the caller throws it.
 */
@Injectable()
export class StorageErrorUtil {
    translate(error: unknown): AppBaseException {
        if (error instanceof AppBaseException) {
            return error;
        }

        if (error instanceof StorageFileNotFoundError) {
            return new StorageObjectNotFoundException();
        }

        if (error instanceof StorageInvalidKeyError) {
            return new StorageKeyInvalidException();
        }

        if (error instanceof StorageBodyLengthError) {
            return new StorageSizeInvalidException();
        }

        if (error instanceof StorageKeyConflictError) {
            return new StorageObjectConflictException();
        }

        if (error instanceof StorageSignedUrlError) {
            return new StorageSignedRequestInvalidException();
        }

        if (error instanceof StorageError) {
            return new StorageServiceUnavailableException(error);
        }

        return new AppUnknownException(error);
    }
}
