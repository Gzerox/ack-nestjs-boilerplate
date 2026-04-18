import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripFileAssetRequestDto } from '@modules/trip/dtos/request/trip-file-asset.request.dto';

/**
 * Base DTO with shared optional scalar fields for both trip create and update.
 * Relations (calendarEvents, contacts, itineraries, invites, medias, attachments)
 * are managed via their own dedicated endpoints.
 */
export class TripDraftBaseRequestDto {
    @IsString()
    @IsOptional()
    subtitle?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @ValidateNested()
    @Type(() => TripFileAssetRequestDto)
    @IsOptional()
    icon?: TripFileAssetRequestDto;

    @ValidateNested()
    @Type(() => TripFileAssetRequestDto)
    @IsOptional()
    coverImage?: TripFileAssetRequestDto;

    @IsString()
    @MaxLength(64)
    @IsOptional()
    timezone?: string;
}
