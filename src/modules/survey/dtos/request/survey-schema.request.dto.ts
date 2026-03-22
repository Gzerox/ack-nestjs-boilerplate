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
import { EnumSurveyQuestionType } from '@generated/prisma-client';

export class SurveySchemaOptionRequestDto {
    @IsString()
    @IsNotEmpty()
    value: string;

    @IsString()
    @IsNotEmpty()
    label: string;
}

export class SurveySchemaValidationRequestDto {
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

export class SurveySchemaQuestionRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(EnumSurveyQuestionType)
    @IsNotEmpty()
    type: EnumSurveyQuestionType;

    @IsString()
    @IsNotEmpty()
    label: string;

    @IsBoolean()
    @IsNotEmpty()
    required: boolean;

    @IsString()
    @IsOptional()
    placeholder?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveySchemaOptionRequestDto)
    @IsOptional()
    options?: SurveySchemaOptionRequestDto[];

    @ValidateNested()
    @Type(() => SurveySchemaValidationRequestDto)
    @IsOptional()
    validation?: SurveySchemaValidationRequestDto;
}

export class SurveySchemaSectionRequestDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    label: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveySchemaQuestionRequestDto)
    @IsNotEmpty()
    questions: SurveySchemaQuestionRequestDto[];
}
