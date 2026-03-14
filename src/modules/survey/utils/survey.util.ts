import { Injectable } from '@nestjs/common';
import { Survey, SurveyRecipient, SurveyTemplate } from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';
import { SurveyTemplateResponseDto } from '../dtos/response/survey-template.response.dto';
import { SurveyResponseDto } from '../dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '../dtos/response/survey-recipient.response.dto';

@Injectable()
export class SurveyUtil {
    mapTemplateOne(template: SurveyTemplate): SurveyTemplateResponseDto {
        return plainToInstance(SurveyTemplateResponseDto, template);
    }

    mapTemplateList(templates: SurveyTemplate[]): SurveyTemplateResponseDto[] {
        return plainToInstance(SurveyTemplateResponseDto, templates);
    }

    mapSurveyOne(
        survey: Survey & { _count?: { recipients: number } }
    ): SurveyResponseDto {
        return plainToInstance(SurveyResponseDto, survey);
    }

    mapSurveyList(
        surveys: (Survey & { _count?: { recipients: number } })[]
    ): SurveyResponseDto[] {
        return plainToInstance(SurveyResponseDto, surveys);
    }

    mapRecipientOne(recipient: SurveyRecipient): SurveyRecipientResponseDto {
        return plainToInstance(SurveyRecipientResponseDto, recipient);
    }

    mapRecipientList(recipients: SurveyRecipient[]): SurveyRecipientResponseDto[] {
        return plainToInstance(SurveyRecipientResponseDto, recipients);
    }
}
