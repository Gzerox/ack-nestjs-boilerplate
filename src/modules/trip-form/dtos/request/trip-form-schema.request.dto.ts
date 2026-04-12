import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumTripFormQuestionType } from '@generated/prisma-client';

export class TripFormSchemaOptionRequestDto {
    @IsString()
    @IsNotEmpty()
    value: string;

    @IsString()
    @IsNotEmpty()
    label: string;
}

export class TripFormSchemaValidationRequestDto {
    @IsNumber()
    @IsOptional()
    min?: number;

    @IsNumber()
    @IsOptional()
    max?: number;

    @IsBoolean()
    @IsOptional()
    multiline?: boolean;

    @IsNumber()
    @IsOptional()
    maxLength?: number;
}

export class TripFormSchemaQuestionRequestDto {
    @IsEnum(EnumTripFormQuestionType)
    @IsNotEmpty()
    type: EnumTripFormQuestionType;

    @IsString()
    @IsNotEmpty()
    label: string;

    @IsString()
    @IsOptional()
    supportText?: string;

    @IsBoolean()
    required: boolean;

    @IsString()
    @IsOptional()
    placeholder?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripFormSchemaOptionRequestDto)
    @IsOptional()
    options?: TripFormSchemaOptionRequestDto[];

    @ValidateNested()
    @Type(() => TripFormSchemaValidationRequestDto)
    @IsOptional()
    validation?: TripFormSchemaValidationRequestDto;
}

export class TripFormSchemaSectionRequestDto {
    @IsString()
    @IsOptional()
    label?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripFormSchemaQuestionRequestDto)
    @IsNotEmpty()
    questions: TripFormSchemaQuestionRequestDto[];
}
