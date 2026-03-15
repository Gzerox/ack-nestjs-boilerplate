import { SurveyRecipientStatus } from '@generated/prisma-client';
import { SurveyAnswer } from '@modules/survey/interfaces/survey.interface';

export class SurveyRecipientResponseDto {
    id: string;
    surveyId: string;
    userId: string;
    status: SurveyRecipientStatus;
    answers: SurveyAnswer[] | null;
    submittedAt: Date | null;
    sourceType: string | null;
    sourceId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
