import {
    IsArray,
    IsDate,
    IsMongoId,
    IsNotEmpty,
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

export class TripCreateDraftRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

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

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    endDate: Date;

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
}
