import {
    IsEnum,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripMediaKind } from '@generated/prisma-client';
import { TripFileAssetRequestDto } from '@modules/trip/dtos/request/trip-file-asset.request.dto';

export class TripMediaCreateRequestDto {
    @IsEnum(TripMediaKind)
    @IsNotEmpty()
    kind: TripMediaKind;

    @ValidateNested()
    @Type(() => TripFileAssetRequestDto)
    @IsNotEmpty()
    file: TripFileAssetRequestDto;

    @IsString()
    @IsOptional()
    caption?: string;

    @IsMongoId()
    @IsOptional()
    calendarEventId?: string;
}
