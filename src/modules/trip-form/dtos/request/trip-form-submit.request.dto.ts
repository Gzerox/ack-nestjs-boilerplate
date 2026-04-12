import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripFormAnswerUpsertRequestDto } from '@modules/trip-form/dtos/request/trip-form-answer-upsert.request.dto';

export class TripFormSubmitRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripFormAnswerUpsertRequestDto)
    @IsOptional()
    answers?: TripFormAnswerUpsertRequestDto[];
}
