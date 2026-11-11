import {
    SetMetadata,
    UseGuards,
    UseInterceptors,
    applyDecorators,
    createParamDecorator,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ClsServiceManager } from 'nestjs-cls';
import { StorageLocalDriverGuard } from '@common/storage/guards/storage.local-driver.guard';
import { StorageUploadInterceptor } from '@common/storage/interceptors/storage.upload.interceptor';
import { FileUploadErrorInterceptor } from '@common/file/interceptors/file.upload-error.interceptor';
import { DocFileErrorResponses } from '@common/doc/constants/doc.constant';
import {
    StorageStoredUploadStoreKey,
    StorageUploadOptionsMetaKey,
} from '@common/storage/constants/storage.constant';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';
import type {
    IStorageUploadSingleOptions,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';

/**
 * Answers 404 on the decorated local-driver delivery route unless `STORAGE_DRIVER` is `local`.
 * @public
 */
export function StorageLocalDriverProtected(): ClassDecorator &
    MethodDecorator {
    return applyDecorators(UseGuards(StorageLocalDriverGuard));
}

/**
 * Accepts one file under a multipart field and streams it to the disk for `visibility`, after detecting its type
 * from the bytes; the handler reads the result with `@StoredUpload()`.
 * Emits multipart OpenAPI (`ApiConsumes` + binary `ApiBody`) and the upload error kit.
 * @public
 */
export function StorageUploadSingle(
    options: IStorageUploadSingleOptions
): MethodDecorator {
    return applyDecorators(
        SetMetadata(StorageUploadOptionsMetaKey, options),
        ApiConsumes('multipart/form-data'),
        ApiBody({
            schema: {
                type: 'object',
                properties: {
                    [options.fieldName]: { type: 'string', format: 'binary' },
                },
            },
        }),
        DocFileErrorResponses.extensionInvalid,
        DocFileErrorResponses.required,
        DocFileErrorResponses.exceedMaxSizeUpload,
        DocFileErrorResponses.exceedMaxFiles,
        DocFileErrorResponses.fieldUnexpected,
        DocFileErrorResponses.multipartInvalid,
        UseInterceptors(FileUploadErrorInterceptor, StorageUploadInterceptor)
    );
}

/**
 * Reads the asset `StorageUploadSingle` stored for the request; throws when the route stored none.
 * @public
 */
export const StoredUpload = createParamDecorator((): IStoredAsset => {
    const asset = ClsServiceManager.getClsService().get<
        IStoredAsset | undefined
    >(StorageStoredUploadStoreKey);
    if (asset === undefined || asset === null) {
        throw new RequestContextMissingException(StorageStoredUploadStoreKey);
    }

    return asset;
});
