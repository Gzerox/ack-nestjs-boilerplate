import {
    IAsset,
    IAssetCreateOptions,
    IAssetUploadInput,
} from '@common/asset/interfaces/asset.interface';
import {
    IPaginationCursorReturn,
    IPaginationQueryCursorParams,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@prisma/client';

export interface IAssetService {
    upload(
        input: IAssetUploadInput,
        createdBy: string,
        options?: IAssetCreateOptions
    ): Promise<IAsset>;
    findOneById(assetId: string): Promise<IAsset>;
    findOneByUploaderId(assetId: string, uploaderId: string): Promise<IAsset>;
    findWithPaginationOffset(
        params: IPaginationQueryOffsetParams<
            Prisma.AssetSelect,
            Prisma.AssetWhereInput
        >
    ): Promise<IResponsePagingReturn<IAsset>>;
    findWithPaginationCursor(
        params: IPaginationQueryCursorParams<
            Prisma.AssetSelect,
            Prisma.AssetWhereInput
        >
    ): Promise<IPaginationCursorReturn<IAsset>>;
    delete(assetId: string, deletedBy: string): Promise<void>;
}
