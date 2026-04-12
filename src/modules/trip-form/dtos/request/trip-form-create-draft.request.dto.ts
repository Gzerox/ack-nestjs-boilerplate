import {
    IsArray,
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumTripFormKind } from '@generated/prisma-client';
import { TripFormSchemaSectionRequestDto } from '@modules/trip-form/dtos/request/trip-form-schema.request.dto';

export class TripFormCreateDraftRequestDto {
    @IsEnum(EnumTripFormKind)
    @IsNotEmpty()
    kind: EnumTripFormKind;

    @IsString()
    @IsNotEmpty()
    title: string;

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
    @IsNotEmpty()
    sections: TripFormSchemaSectionRequestDto[];
}
