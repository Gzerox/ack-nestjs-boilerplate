import { SurveySchema } from '@generated/prisma-client';

export class SurveyTemplateResponseDto {
    id: string;
    createdBy: string;
    name: string;
    schema: SurveySchema;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
