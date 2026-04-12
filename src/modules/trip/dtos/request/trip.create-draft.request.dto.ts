import {
    IsDate,
    IsNotEmpty,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripDraftBaseRequestDto } from '@modules/trip/dtos/request/trip.draft-base.request.dto';

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
}
