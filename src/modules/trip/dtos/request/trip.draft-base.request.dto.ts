import {
    IsArray,
    IsMongoId,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripFileAssetRequestDto } from '@modules/trip/dtos/request/trip-file-asset.request.dto';
import { TripCalendarEventCreateRequestDto } from '@modules/trip/dtos/request/trip-calendar-event.create.request.dto';
import { TripInviteCreateRequestDto } from '@modules/trip/dtos/request/trip-invite.create.request.dto';
import { TripMediaCreateRequestDto } from '@modules/trip/dtos/request/trip-media.create.request.dto';
import { TripAttachmentCreateRequestDto } from '@modules/trip/dtos/request/trip-attachment.create.request.dto';
import { TripItineraryCreateRequestDto } from '@modules/trip/dtos/request/trip-itinerary.create.request.dto';

/**
 * Base DTO with shared optional fields for both trip create and update.
 * Subclasses override fields as needed to be required or optional.
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

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripCalendarEventCreateRequestDto)
    @IsOptional()
    calendarEvents?: TripCalendarEventCreateRequestDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripInviteCreateRequestDto)
    @IsOptional()
    invites?: TripInviteCreateRequestDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripMediaCreateRequestDto)
    @IsOptional()
    medias?: TripMediaCreateRequestDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripAttachmentCreateRequestDto)
    @IsOptional()
    attachments?: TripAttachmentCreateRequestDto[];

    @IsArray()
    @IsMongoId({ each: true })
    @IsOptional()
    contactIds?: string[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripItineraryCreateRequestDto)
    @IsOptional()
    itineraries?: TripItineraryCreateRequestDto[];
}
