import {
    IsArray,
    IsDate,
    IsISO8601,
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

export class TripUpdateDraftRequestDto {
    @IsISO8601()
    @IsNotEmpty()
    updatedAt: string;

    @IsString()
    @IsOptional()
    title?: string;

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
    @IsOptional()
    startDate?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    endDate?: Date;

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
}
