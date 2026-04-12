import { IsArray, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripFormSchemaSectionRequestDto } from '@modules/trip-form/dtos/request/trip-form-schema.request.dto';

export class TripFormUpdateDraftRequestDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    closesAt?: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripFormSchemaSectionRequestDto)
    @IsOptional()
    sections?: TripFormSchemaSectionRequestDto[];
}
