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
import { EnumFormQuestionType } from '@generated/prisma-client';

export class FormSchemaOptionRequestDto {
    @IsString()
    @IsNotEmpty()
    value: string;

    @IsString()
    @IsNotEmpty()
    label: string;
}

export class FormSchemaValidationRequestDto {
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

export class FormSchemaQuestionRequestDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsEnum(EnumFormQuestionType)
    @IsNotEmpty()
    type: EnumFormQuestionType;

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
    @Type(() => FormSchemaOptionRequestDto)
    @IsOptional()
    options?: FormSchemaOptionRequestDto[];

    @ValidateNested()
    @Type(() => FormSchemaValidationRequestDto)
    @IsOptional()
    validation?: FormSchemaValidationRequestDto;
}

export class FormSchemaSectionRequestDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsOptional()
    label?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FormSchemaQuestionRequestDto)
    @IsNotEmpty()
    questions: FormSchemaQuestionRequestDto[];
}
