import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

export { Survey, SurveyRecipient, SurveyTemplate } from '@generated/prisma-client';
export type { SurveySchema, SurveySchemaQuestion, SurveySchemaSection, SurveySchemaOption, SurveySchemaValidation } from '@generated/prisma-client';

/**
 * Answer Type (for SurveyRecipient.answers)
 * Mirrors the SurveyAnswer composite type in prisma/schema.prisma
 * Supports any HTML input type (text, email, number, checkbox, radio, select, etc.)
 */
export type SurveyAnswer = {
    questionId: string;
    sectionId: string;
    type: string; // any HTML input type: text, email, number, date, checkbox, radio, select, etc.
    value?: string | number | boolean; // for single-value inputs
    values?: (string | number | boolean)[]; // for multi-value inputs (checkbox, multi-select)
};

export type ISurveyWithRecipientData = {
    survey: SurveyResponseDto;
    recipient: SurveyRecipientResponseDto;
};

export type ISurveyCreateData = {
    survey: SurveyResponseDto;
    recipientCount: number;
};
