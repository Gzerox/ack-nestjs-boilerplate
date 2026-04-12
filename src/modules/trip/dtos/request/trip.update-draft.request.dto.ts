import {
    IsDate,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripDraftBaseRequestDto } from '@modules/trip/dtos/request/trip.draft-base.request.dto';

export class TripUpdateDraftRequestDto extends TripDraftBaseRequestDto {
    @IsISO8601()
    @IsNotEmpty()
    updatedAt: string;

    @IsString()
    @IsOptional()
    title?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    startDate?: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    endDate?: Date;
}
