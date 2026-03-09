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

export interface IAssetService {
    upload(
        input: IAssetUploadInput,
        createdBy: string,
        options?: IAssetCreateOptions
    ): Promise<IAsset>;
    findOneByUploaderId(assetId: string, uploaderId: string): Promise<IAsset>;
    findWithPaginationOffset(
        params: IPaginationQueryOffsetParams
    ): Promise<IResponsePagingReturn<IAsset>>;
    findWithPaginationCursor(
        params: IPaginationQueryCursorParams
    ): Promise<IPaginationCursorReturn<IAsset>>;
    delete(assetId: string): Promise<void>;
}
