import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import {
    StorageBodyLengthError,
    StorageError,
    StorageFileNotFoundError,
    StorageInvalidKeyError,
    StorageKeyConflictError,
    StorageServiceError,
    StorageSignedUrlError,
} from '@nestjs/storage';
import { StorageErrorUtil } from '@common/storage/utils/storage.error.util';
import { EnumStorageStatusCodeError } from '@common/storage/enums/storage.status-code.enum';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import { StorageObjectConflictException } from '@common/storage/exceptions/storage.object-conflict.exception';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import { StorageSignedRequestInvalidException } from '@common/storage/exceptions/storage.signed-request-invalid.exception';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StoragePromotionFailedException } from '@common/storage/exceptions/storage.promotion-failed.exception';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';

describe('StorageErrorUtil', () => {
    let util: StorageErrorUtil;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [StorageErrorUtil],
        }).compile();

        util = module.get(StorageErrorUtil);
    });

    describe('translate', () => {
        it('maps StorageFileNotFoundError onto StorageObjectNotFoundException', () => {
            const result = util.translate(
                new StorageFileNotFoundError('users/user-1/photo.png')
            );

            expect(result).toBeInstanceOf(StorageObjectNotFoundException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.objectNotFound,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.objectNotFound
                    ],
                httpStatus: HttpStatus.NOT_FOUND,
                messagePath: 'storage.error.objectNotFound',
            });
        });

        it('maps StorageInvalidKeyError onto StorageKeyInvalidException', () => {
            const result = util.translate(
                new StorageInvalidKeyError('absolute')
            );

            expect(result).toBeInstanceOf(StorageKeyInvalidException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.keyInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.keyInvalid
                    ],
                httpStatus: HttpStatus.BAD_REQUEST,
                messagePath: 'storage.error.keyInvalid',
            });
        });

        it('maps StorageBodyLengthError onto StorageSizeInvalidException', () => {
            const result = util.translate(new StorageBodyLengthError(10, 12));

            expect(result).toBeInstanceOf(StorageSizeInvalidException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.sizeInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.sizeInvalid
                    ],
                httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
                messagePath: 'storage.error.sizeInvalid',
            });
        });

        it('maps StorageKeyConflictError onto StorageObjectConflictException', () => {
            const result = util.translate(new StorageKeyConflictError('a/b'));

            expect(result).toBeInstanceOf(StorageObjectConflictException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.objectConflict,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.objectConflict
                    ],
                httpStatus: HttpStatus.CONFLICT,
                messagePath: 'storage.error.objectConflict',
            });
        });

        it('maps StorageSignedUrlError onto StorageSignedRequestInvalidException', () => {
            const result = util.translate(new StorageSignedUrlError('expired'));

            expect(result).toBeInstanceOf(StorageSignedRequestInvalidException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.signedRequestInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.signedRequestInvalid
                    ],
                httpStatus: HttpStatus.FORBIDDEN,
                messagePath: 'storage.error.signedRequestInvalid',
            });
        });

        it('maps StorageServiceError onto a sanitized StorageServiceUnavailableException carrying the provider error as rawError', () => {
            const error = new StorageServiceError({
                operation: 'list',
                code: 'AccessDenied',
                message: 'Access Denied for bucket ack-private',
                upstreamStatus: 403,
            });

            const result = util.translate(error);

            expect(result).toBeInstanceOf(StorageServiceUnavailableException);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.serviceUnavailable,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.serviceUnavailable
                    ],
                httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
                messagePath: 'storage.error.serviceUnavailable',
                message: 'storage.error.serviceUnavailable',
                rawError: error,
            });
        });

        it('maps any other StorageError onto StorageServiceUnavailableException', () => {
            const error = new StorageError('disk misconfigured');

            const result = util.translate(error);

            expect(result).toBeInstanceOf(StorageServiceUnavailableException);
            expect(result).toMatchObject({ rawError: error });
        });

        it('wraps an unknown error in AppUnknownException', () => {
            const error = new Error('boom');

            const result = util.translate(error);

            expect(result).toBeInstanceOf(AppUnknownException);
            expect(result).toMatchObject({ rawError: error });
        });

        it('returns an AppBaseException unchanged', () => {
            const exception = new StorageContentTypeInvalidException();

            const result = util.translate(exception);

            expect(result).toBe(exception);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.contentTypeInvalid,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.contentTypeInvalid
                    ],
                httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
                messagePath: 'storage.error.contentTypeInvalid',
            });
        });

        it('returns StoragePromotionFailedException unchanged with its 500 status', () => {
            const cause = new Error('stream reset');
            const exception = new StoragePromotionFailedException(cause);

            const result = util.translate(exception);

            expect(result).toBe(exception);
            expect(result).toMatchObject({
                module: 'storage',
                statusCode: EnumStorageStatusCodeError.promotionFailed,
                statusCodeKey:
                    EnumStorageStatusCodeError[
                        EnumStorageStatusCodeError.promotionFailed
                    ],
                httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
                messagePath: 'storage.error.promotionFailed',
                rawError: cause,
            });
        });
    });
});
