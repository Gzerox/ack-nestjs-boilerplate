import { Injectable } from '@nestjs/common';
import { Survey, SurveyAnswer, SurveyRecipient } from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyUserResponseDto } from '@modules/survey/dtos/response/survey-user.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

@Injectable()
export class SurveyUtil {
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

    mapSurveyUser(survey: Survey): SurveyUserResponseDto {
        return plainToInstance(SurveyUserResponseDto, survey);
    }

    mapRecipientOne(
        recipient: SurveyRecipient & { answers?: SurveyAnswer[] }
    ): SurveyRecipientResponseDto {
        return plainToInstance(SurveyRecipientResponseDto, recipient);
    }

    mapRecipientList(
        recipients: (SurveyRecipient & { answers?: SurveyAnswer[] })[]
    ): SurveyRecipientResponseDto[] {
        return plainToInstance(SurveyRecipientResponseDto, recipients);
    }
}
