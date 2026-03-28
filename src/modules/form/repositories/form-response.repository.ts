import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumFormResponseStatus,
    EnumFormStatus,
    FormAnswer,
    FormResponse,
    Prisma,
} from '@generated/prisma-client';
import { FormAnswerUpsertDto } from '@modules/form/dtos/request/form-answer-upsert.dto';

@Injectable()
export class FormResponseRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findByAssignmentAndUser(
        assignmentId: string,
        userId: string
    ): Promise<(FormResponse & { answers: FormAnswer[] }) | null> {
        return this.databaseService.formResponse.findUnique({
            where: { assignmentId_userId: { assignmentId, userId } },
            include: { answers: true },
        });
    }

    async findManyByUser(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        now?: Date
    ): Promise<IResponsePagingReturn<FormResponse>> {
        const timeWhere: Prisma.FormResponseWhereInput | undefined = now
            ? {
                  assignment: {
                      isActive: true,
                      form: { status: EnumFormStatus.published },
                      AND: [
                          {
                              OR: [
                                  { startsAt: null },
                                  { startsAt: { lte: now } },
                              ],
                          },
                          {
                              OR: [
                                  { closesAt: null },
                                  { closesAt: { gt: now } },
                              ],
                          },
                      ],
                  },
              }
            : undefined;

        return this.paginationService.offset<
            FormResponse,
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >(this.databaseService.formResponse, {
            ...pagination,
            where: {
                ...pagination.where,
                ...status,
                userId,
                ...(timeWhere && { AND: [timeWhere] }),
            },
        });
    }

    async findManyByForm(
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >
    ): Promise<IResponsePagingReturn<FormResponse>> {
        return this.paginationService.offset<
            FormResponse,
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >(this.databaseService.formResponse, {
            ...pagination,
            where: { ...pagination.where, formId },
        });
    }

    async upsertAnswers(
        responseId: string,
        formId: string,
        answers: FormAnswerUpsertDto[],
        status: EnumFormResponseStatus,
        submittedAt?: Date
    ): Promise<FormResponse & { answers: FormAnswer[] }> {
        return this.databaseService.$transaction(async tx => {
            await tx.formAnswer.deleteMany({ where: { responseId } });

            if (answers.length > 0) {
                await tx.formAnswer.createMany({
                    data: answers.map(answer => ({
                        formId,
                        responseId,
                        sectionId: answer.sectionId,
                        questionId: answer.questionId,
                        numberValue: answer.numberValue ?? null,
                        optionValue: answer.optionValue ?? null,
                        optionValues: answer.optionValues ?? [],
                        textValue: answer.textValue ?? null,
                        booleanValue: answer.booleanValue ?? null,
                        dateValue: answer.dateValue ?? null,
                    })),
                });
            }

            return tx.formResponse.update({
                where: { id: responseId },
                data: {
                    status,
                    ...(submittedAt && { submittedAt }),
                },
                include: { answers: true },
            });
        });
    }

    async countByFormGroupedByStatus(
        formId: string
    ): Promise<{ status: EnumFormResponseStatus; _count: number }[]> {
        const result = await this.databaseService.formResponse.groupBy({
            by: ['status'],
            where: { formId },
            _count: true,
        });
        return result.map(r => ({ status: r.status, _count: r._count }));
    }

    async aggregateAnswersByQuestion(
        formId: string,
        questionId: string
    ): Promise<FormAnswer[]> {
        return this.databaseService.formAnswer.findMany({
            where: { formId, questionId },
            take: 1000,
        });
    }
}
