import { FileSingleDto } from '@common/file/dtos/file.single.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnumAssetAccess } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UserUploadAssetRequestDto extends FileSingleDto {
    @ApiPropertyOptional({
        enum: EnumAssetAccess,
        default: EnumAssetAccess.private,
        description:
            'Asset access mode. Defaults to private when not provided.',
    })
    @IsOptional()
    @IsEnum(EnumAssetAccess)
    access?: EnumAssetAccess;
}
