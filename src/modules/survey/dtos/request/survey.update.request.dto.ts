import {
    IsArray,
    IsDate,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SurveySchemaSectionRequestDto } from '@modules/survey/dtos/request/survey-schema.request.dto';

export class SurveyUpdateRequestDto {
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
    @Type(() => SurveySchemaSectionRequestDto)
    @IsOptional()
    sections?: SurveySchemaSectionRequestDto[];
}

export class SurveyAnswerUpsertDto {
    @IsString()
    @IsNotEmpty()
    sectionId: string;

    @IsString()
    @IsNotEmpty()
    questionId: string;

    @IsNumber()
    @IsOptional()
    numberValue?: number;

    @IsString()
    @IsOptional()
    optionValue?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    optionValues?: string[];

    @IsString()
    @IsOptional()
    textValue?: string;
}