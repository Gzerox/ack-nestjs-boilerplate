import { IsArray, IsNotEmpty } from 'class-validator';
import { SurveyAnswer } from '@modules/survey/interfaces/survey.interface';

export class SurveyRecipientUpdateRequestDto {
    @IsArray()
    @IsNotEmpty()
    answers: SurveyAnswer[];
}

export class SurveyRecipientSubmitRequestDto {
    @IsArray()
    @IsNotEmpty()
    answers: SurveyAnswer[];
}
