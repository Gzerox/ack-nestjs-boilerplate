import { IsArray, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SurveyAnswerUpsertDto } from '@modules/survey/dtos/request/survey.update.request.dto';

export class SurveyUserPatchRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveyAnswerUpsertDto)
    @IsNotEmpty()
    answers: SurveyAnswerUpsertDto[];
}

export class SurveyUserSubmitRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SurveyAnswerUpsertDto)
    @IsOptional()
    answers?: SurveyAnswerUpsertDto[];
}
