import {
    IsArray,
    IsDate,
    IsMongoId,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SurveySchemaSectionRequestDto } from '@modules/survey/dtos/request/survey-schema.request.dto';

export class SurveyCreateRequestDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    closesAt: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveySchemaSectionRequestDto)
    @IsNotEmpty()
    sections: SurveySchemaSectionRequestDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveyRecipientCreateDto)
    @IsNotEmpty()
    recipients: SurveyRecipientCreateDto[];
}

class SurveyRecipientCreateDto {
    @IsString()
    @IsMongoId()
    @IsNotEmpty()
    userId: string;
}