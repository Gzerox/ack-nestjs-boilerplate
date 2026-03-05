import { IsEnum, IsOptional } from 'class-validator';
import { EnumAssetAccess } from '@prisma/client';

export class AssetUploadRequestDto {
    @IsOptional()
    @IsEnum(EnumAssetAccess)
    access?: EnumAssetAccess = EnumAssetAccess.private;
}
