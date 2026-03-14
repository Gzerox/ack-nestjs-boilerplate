import { SurveySchema } from '@generated/prisma-client';

export class SurveyResponseDto {
    id: string;
    createdBy: string;
    title: string;
    description: string | null;
    schemaSnapshot: SurveySchema;
    closesAt: Date;
    isActive: boolean;
    publishedAt: Date;
    createdAt: Date;
    updatedAt: Date;

    _count?: { recipients: number };
}
