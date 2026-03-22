import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { EnumSurveyStatus, Prisma, Survey } from '@generated/prisma-client';

@Injectable()
export class SurveyRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async createWithRecipients(
        surveyData: Prisma.SurveyCreateInput,
        sections: Omit<Prisma.SurveySectionCreateManyInput, 'surveyId'>[],
        questions: Omit<Prisma.SurveyQuestionCreateManyInput, 'surveyId'>[],
        recipients: Omit<Prisma.SurveyRecipientCreateManyInput, 'surveyId'>[]
    ): Promise<Survey & { _count: { recipients: number } }> {
        return this.databaseService.$transaction(async (tx) => {
            const survey = await tx.survey.create({
                data: surveyData,
                include: { _count: { select: { recipients: true } } },
            });
            if (sections.length > 0) {
                await tx.surveySection.createMany({
                    data: sections.map((s) => ({ ...s, surveyId: survey.id })),
                });
            }
            if (questions.length > 0) {
                await tx.surveyQuestion.createMany({
                    data: questions.map((q) => ({ ...q, surveyId: survey.id })),
                });
            }
            if (recipients.length > 0) {
                await tx.surveyRecipient.createMany({
                    data: recipients.map((r) => ({ ...r, surveyId: survey.id })),
                });
            }
            return survey;
        });
    }

    async findMany(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<Survey>> {
        return this.paginationService.offset<
            Survey,
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >(this.databaseService.survey, {
            ...pagination,
            where: {
                ...pagination.where,
                ...status,
                ...(createdBy && { createdBy }),
            },
        });
    }

    async findById(id: string, createdBy?: string): Promise<Survey | null> {
        return this.databaseService.survey.findFirst({
            where: { id, ...(createdBy && { createdBy }) },
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey | null>;
    }

    async update(id: string, data: Prisma.SurveyUpdateInput): Promise<Survey> {
        return this.databaseService.survey.update({
            where: { id },
            data,
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey>;
    }

    async archive(id: string): Promise<Survey> {
        return this.databaseService.survey.update({
            where: { id },
            data: { status: EnumSurveyStatus.archived },
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey>;
    }

    async delete(id: string): Promise<Survey> {
        return this.databaseService.survey.delete({
            where: { id },
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey>;
    }

    async existById(id: string): Promise<{ id: string } | null> {
        return this.databaseService.survey.findUnique({
            where: { id },
            select: { id: true },
        });
    }
}
