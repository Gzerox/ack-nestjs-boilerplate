import 'reflect-metadata';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import {
    GUARDS_METADATA,
    INTERCEPTORS_METADATA,
    ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { ClsServiceManager } from 'nestjs-cls';
import type { ClsService } from 'nestjs-cls';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import {
    StorageLocalDriverProtected,
    StorageUploadSingle,
    StoredUpload,
} from '@common/storage/decorators/storage.decorator';
import {
    StorageStoredUploadStoreKey,
    StorageUploadOptionsMetaKey,
} from '@common/storage/constants/storage.constant';
import { StorageLocalDriverGuard } from '@common/storage/guards/storage.local-driver.guard';
import { StorageUploadInterceptor } from '@common/storage/interceptors/storage.upload.interceptor';
import { FileUploadErrorInterceptor } from '@common/file/interceptors/file.upload-error.interceptor';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';
import type {
    IStorageUploadSingleOptions,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';

vi.mock('nestjs-cls', () => ({
    ClsServiceManager: {
        getClsService: vi.fn(),
    },
}));

vi.mock('@common/storage/guards/storage.local-driver.guard', () => ({
    StorageLocalDriverGuard: vi.fn(),
}));

vi.mock('@common/storage/interceptors/storage.upload.interceptor', () => ({
    StorageUploadInterceptor: vi.fn(),
}));

describe('StorageLocalDriverProtected', () => {
    it('applies the local-driver guard', () => {
        const handler = vi.fn();

        StorageLocalDriverProtected()({}, 'handler', { value: handler });

        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
            StorageLocalDriverGuard,
        ]);
    });
});

describe('StorageUploadSingle', () => {
    it('stores the route options and runs the upload interceptor inside the file error interceptor', () => {
        const options: IStorageUploadSingleOptions = {
            fieldName: 'photo',
            visibility: EnumStorageVisibility.public,
            scopePrefixPatternConfigKey: 'user.photo.scopePrefixPattern',
            maxSizeInBytesConfigKey: 'user.photo.maxSizeInBytes',
            extensions: [EnumFileExtensionImage.png],
        };
        const handler = vi.fn();

        StorageUploadSingle(options)({}, 'handler', { value: handler });

        expect(Reflect.getMetadata(StorageUploadOptionsMetaKey, handler)).toBe(
            options
        );
        expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toEqual([
            FileUploadErrorInterceptor,
            StorageUploadInterceptor,
        ]);
    });
});

describe('StoredUpload', () => {
    const clsService: MockProxy<ClsService> = mock<ClsService>();

    const extractFactory = (): ((data: unknown, ctx: unknown) => unknown) => {
        const target = { constructor: vi.fn() };
        StoredUpload()(target, 'handler', 0);

        const args = Reflect.getMetadata(
            ROUTE_ARGS_METADATA,
            target.constructor,
            'handler'
        );
        const key = Object.keys(args)[0];

        return args[key].factory;
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(ClsServiceManager.getClsService).mockReturnValue(clsService);
    });

    it('returns the asset the upload interceptor stored', () => {
        const asset: IStoredAsset = {
            key: 'users/user-1/profile/upload-1.png',
            visibility: EnumStorageVisibility.public,
            contentType: 'image/png',
            size: 64,
            etag: '"etag-1"',
        };
        clsService.get.mockReturnValue(asset);

        const result = extractFactory()(undefined, {});

        expect(result).toBe(asset);
        expect(clsService.get).toHaveBeenCalledWith(
            StorageStoredUploadStoreKey
        );
    });

    it('throws RequestContextMissingException when no asset was stored', () => {
        clsService.get.mockReturnValue(undefined);

        expect(() => extractFactory()(undefined, {})).toThrow(
            RequestContextMissingException
        );
    });
});
