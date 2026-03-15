import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Prisma, SurveyRecipient, SurveyRecipientStatus } from '@generated/prisma-client';

@Injectable()
export class SurveyRecipientRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async createMany(
        data: Prisma.SurveyRecipientCreateManyInput[]
    ): Promise<Prisma.BatchPayload> {
        return this.databaseService.surveyRecipient.createMany({ data });
    }

    async findManyBySurvey(
        surveyId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipient>> {
        return this.paginationService.offset<
            SurveyRecipient,
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >(this.databaseService.surveyRecipient, {
            ...pagination,
            where: { ...pagination.where, surveyId },
        });
    }

    async findByIdAndSurvey(
        id: string,
        surveyId: string
    ): Promise<SurveyRecipient | null> {
        return this.databaseService.surveyRecipient.findFirst({
            where: { id, surveyId },
        });
    }

    async findBySurveyAndUser(
        surveyId: string,
        userId: string
    ): Promise<SurveyRecipient | null> {
        return this.databaseService.surveyRecipient.findUnique({
            where: { surveyId_userId: { surveyId, userId } },
        });
    }

    async updateAnswers(
        id: string,
        answers: any,
        status: SurveyRecipientStatus,
        submittedAt?: Date
    ): Promise<SurveyRecipient> {
        return this.databaseService.surveyRecipient.update({
            where: { id },
            data: {
                answers,
                status,
                ...(submittedAt && { submittedAt }),
            },
        });
    }

    async findManyByUser(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipient>> {
        return this.paginationService.offset<
            SurveyRecipient,
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >(this.databaseService.surveyRecipient, {
            ...pagination,
            where: { ...pagination.where, userId },
        });
    }
}
