import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumSurveyRecipientStatus,
    Prisma,
    SurveyAnswer,
    SurveyRecipient,
} from '@generated/prisma-client';
import { SurveyAnswerUpsertDto } from '@modules/survey/dtos/request/survey.update.request.dto';

@Injectable()
export class SurveyRecipientRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

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
    ): Promise<(SurveyRecipient & { answers: SurveyAnswer[] }) | null> {
        return this.databaseService.surveyRecipient.findFirst({
            where: { id, surveyId },
            include: { answers: true },
        });
    }

    async findBySurveyAndUser(
        surveyId: string,
        userId: string
    ): Promise<(SurveyRecipient & { answers: SurveyAnswer[] }) | null> {
        return this.databaseService.surveyRecipient.findUnique({
            where: { surveyId_userId: { surveyId, userId } },
            include: { answers: true },
        });
    }

    async upsertAnswers(
        recipientId: string,
        surveyId: string,
        answers: SurveyAnswerUpsertDto[],
        status: EnumSurveyRecipientStatus,
        submittedAt?: Date
    ): Promise<SurveyRecipient & { answers: SurveyAnswer[] }> {
        return this.databaseService.$transaction(async (tx) => {
            await Promise.all(
                answers.map((answer) =>
                    tx.surveyAnswer.upsert({
                        where: { recipientId_questionId: { recipientId, questionId: answer.questionId } },
                        create: {
                            surveyId,
                            recipientId,
                            sectionId: answer.sectionId,
                            questionId: answer.questionId,
                            numberValue: answer.numberValue ?? null,
                            optionValue: answer.optionValue ?? null,
                            optionValues: answer.optionValues ?? [],
                            textValue: answer.textValue ?? null,
                        },
                        update: {
                            numberValue: answer.numberValue ?? null,
                            optionValue: answer.optionValue ?? null,
                            optionValues: answer.optionValues ?? [],
                            textValue: answer.textValue ?? null,
                        },
                    })
                )
            );

            return tx.surveyRecipient.update({
                where: { id: recipientId },
                data: {
                    status,
                    ...(submittedAt && { submittedAt }),
                },
                include: { answers: true },
            });
        });
    }

    async findManyByUser(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<SurveyRecipient>> {
        return this.paginationService.offset<
            SurveyRecipient,
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >(this.databaseService.surveyRecipient, {
            ...pagination,
            where: {
                ...pagination.where,
                ...status,
                userId,
            },
        });
    }
}
