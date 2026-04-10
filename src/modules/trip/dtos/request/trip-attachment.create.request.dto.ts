import {
    IsBoolean,
    IsDefined,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
    ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TripAttachmentType } from '@generated/prisma-client';
import { TripFileAssetRequestDto } from '@modules/trip/dtos/request/trip-file-asset.request.dto';

export class TripAttachmentCreateRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsEnum(TripAttachmentType)
    @IsNotEmpty()
    type: TripAttachmentType;

    @Transform(
        ({ value }: { value?: string }) =>
            typeof value === 'string' ? value.trim() : value
    )
    @ValidateIf(o => !o.file)
    @IsString()
    @IsNotEmpty()
    contentMarkdown?: string;

    @ValidateIf(o => !o.contentMarkdown)
    @ValidateNested()
    @Type(() => TripFileAssetRequestDto)
    @IsDefined()
    file?: TripFileAssetRequestDto;

    @IsString()
    @IsOptional()
    displayName?: string;

    @IsBoolean()
    @IsNotEmpty()
    required: boolean;
}
