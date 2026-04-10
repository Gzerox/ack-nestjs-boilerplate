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
    FormAssignment,
    Prisma,
} from '@generated/prisma-client';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';
import { FormAnswerUpsertRequestDto } from '@modules/form/dtos/request/form-answer-upsert.request.dto';
import {
    IFormAssignmentWithAnswers,
    IFormAssignmentWithRelations,
} from '@modules/form/interfaces/form.interface';

@Injectable()
export class FormAssignmentRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(
        formId: string,
        dto: FormAssignmentCreateRequestDto
    ): Promise<FormAssignment> {
        return this.databaseService.formAssignment.create({
            data: {
                formId,
                userId: dto.userId,
                required: dto.required ?? true,
                startsAt: dto.startsAt ?? null,
                closesAt: dto.closesAt ?? null,
                isActive: true,
                status: EnumFormResponseStatus.pending,
            },
        });
    }

    async existByFormAndUser(formId: string, userId: string): Promise<boolean> {
        const count = await this.databaseService.formAssignment.count({
            where: { formId, userId, isActive: true },
        });
        return count > 0;
    }

    async findByIdWithFormAndAnswers(
        id: string,
        userId: string
    ): Promise<IFormAssignmentWithRelations | null> {
        return this.databaseService.formAssignment.findFirst({
            where: { id, userId },
            include: {
                form: {
                    include: {
                        sections: true,
                        questions: true,
                    },
                },
                answers: true,
            },
        }) as Promise<IFormAssignmentWithRelations | null>;
    }

    async submit(
        assignmentId: string,
        formId: string,
        answers: FormAnswerUpsertRequestDto[],
        submittedAt: Date
    ): Promise<IFormAssignmentWithAnswers> {
        return this.databaseService.$transaction(async tx => {
            await tx.formAnswer.deleteMany({ where: { assignmentId } });

            if (answers.length > 0) {
                await tx.formAnswer.createMany({
                    data: answers.map(answer => ({
                        formId,
                        assignmentId,
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

            return tx.formAssignment.update({
                where: { id: assignmentId },
                data: {
                    status: EnumFormResponseStatus.submitted,
                    submittedAt,
                },
                include: { answers: true },
            });
        }) as Promise<IFormAssignmentWithAnswers>;
    }

    async findManyByUser(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        now?: Date
    ): Promise<IResponsePagingReturn<FormAssignment>> {
        const timeWhere: Prisma.FormAssignmentWhereInput | undefined = now
            ? {
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
              }
            : undefined;

        return this.paginationService.offset<
            FormAssignment,
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >(this.databaseService.formAssignment, {
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
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<FormAssignment>> {
        return this.paginationService.offset<
            FormAssignment,
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >(this.databaseService.formAssignment, {
            ...pagination,
            where: { ...pagination.where, formId },
        });
    }

    async countByFormGroupedByStatus(
        formId: string
    ): Promise<{ status: EnumFormResponseStatus; _count: number }[]> {
        const result = await this.databaseService.formAssignment.groupBy({
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
        });
    }
}
