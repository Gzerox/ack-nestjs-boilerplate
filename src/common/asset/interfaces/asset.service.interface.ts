import {
    IAsset,
    IAssetCreateOptions,
    IAssetListOptions,
    IAssetUpdateMetadata,
    IAssetUploadInput,
} from '@common/asset/interfaces/asset.interface';

export interface IAssetService {
    upload(
        input: IAssetUploadInput,
        createdBy: string,
        options?: IAssetCreateOptions
    ): Promise<IAsset>;
    getOne(assetId: string): Promise<IAsset>;
    listByUploader(
        createdBy: string,
        options?: IAssetListOptions
    ): Promise<IAsset[]>;
    updateMetadata(
        assetId: string,
        metadata: IAssetUpdateMetadata,
        updatedBy: string
    ): Promise<IAsset>;
    delete(assetId: string, deletedBy: string): Promise<void>;
}
