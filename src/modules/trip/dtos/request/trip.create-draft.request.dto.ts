import {
    IsArray,
    IsDate,
    IsMongoId,
    IsNotEmpty,
    IsString,
    IsOptional,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripDraftBaseRequestDto } from '@modules/trip/dtos/request/trip.draft-base.request.dto';
import { TripCalendarEventCreateRequestDto } from '@modules/trip/dtos/request/trip-calendar-event.create.request.dto';
import { TripInviteCreateRequestDto } from '@modules/trip/dtos/request/trip-invite.create.request.dto';
import { TripMediaCreateRequestDto } from '@modules/trip/dtos/request/trip-media.create.request.dto';
import { TripAttachmentCreateRequestDto } from '@modules/trip/dtos/request/trip-attachment.create.request.dto';
import { TripItineraryCreateRequestDto } from '@modules/trip/dtos/request/trip-itinerary.create.request.dto';

export class TripCreateDraftRequestDto extends TripDraftBaseRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    endDate: Date;

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
