import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumTripFormResponseStatus,
    EnumTripFormStatus,
    Prisma,
    TripFormAssignment,
} from '@generated/prisma-client';
import { TripFormAssignmentCreateRequestDto } from '@modules/trip-form/dtos/request/trip-form-assignment-create.request.dto';
import { TripFormAnswerUpsertRequestDto } from '@modules/trip-form/dtos/request/trip-form-answer-upsert.request.dto';
import {
    ITripFormAssignmentWithAnswers,
    ITripFormAssignmentWithRelations,
} from '@modules/trip-form/interfaces/trip-form.interface';

@Injectable()
export class TripFormAssignmentRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(
        formId: string,
        tripId: string,
        dto: TripFormAssignmentCreateRequestDto
    ): Promise<TripFormAssignment> {
        return this.databaseService.tripFormAssignment.create({
            data: {
                formId: formId,
                tripId,
                userId: dto.userId,
                required: dto.required ?? true,
                startsAt: dto.startsAt ?? null,
                closesAt: dto.closesAt ?? null,
                isActive: true,
                status: EnumTripFormResponseStatus.pending,
            },
        });
    }

    async existByFormAndUser(formId: string, userId: string): Promise<boolean> {
        const count = await this.databaseService.tripFormAssignment.count({
            where: { formId: formId, userId, isActive: true },
        });
        return count > 0;
    }

    async findByIdWithFormAndAnswers(
        id: string,
        userId: string,
        tripId: string
    ): Promise<ITripFormAssignmentWithRelations | null> {
        return this.databaseService.tripFormAssignment.findFirst({
            where: { id, userId, tripId },
            include: {
                form: {
                    include: {
                        sections: true,
                        questions: true,
                    },
                },
                answers: true,
            },
        }) as Promise<ITripFormAssignmentWithRelations | null>;
    }

    async submit(
        assignmentId: string,
        formId: string,
        answers: TripFormAnswerUpsertRequestDto[],
        submittedAt: Date
    ): Promise<ITripFormAssignmentWithAnswers> {
        return this.databaseService.$transaction(async tx => {
            await tx.tripFormAnswer.deleteMany({ where: { assignmentId } });

            if (answers.length > 0) {
                await tx.tripFormAnswer.createMany({
                    data: answers.map(answer => ({
                        formId: formId,
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

            return tx.tripFormAssignment.update({
                where: { id: assignmentId },
                data: {
                    status: EnumTripFormResponseStatus.submitted,
                    submittedAt,
                },
                include: { answers: true },
            });
        }) as Promise<ITripFormAssignmentWithAnswers>;
    }

    async findManyByUser(
        userId: string,
        tripId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        now?: Date
    ): Promise<IResponsePagingReturn<TripFormAssignment>> {
        const timeWhere: Prisma.TripFormAssignmentWhereInput | undefined = now
            ? {
                  isActive: true,
                  form: { status: EnumTripFormStatus.published },
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
            TripFormAssignment,
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >(this.databaseService.tripFormAssignment, {
            ...pagination,
            where: {
                ...pagination.where,
                ...status,
                userId,
                tripId,
                ...(timeWhere && { AND: [timeWhere] }),
            },
        });
    }

    async findManyByForm(
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<TripFormAssignment>> {
        return this.paginationService.offset<
            TripFormAssignment,
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >(this.databaseService.tripFormAssignment, {
            ...pagination,
            where: { ...pagination.where, formId: formId },
        });
    }

    async countByFormGroupedByStatus(
        formId: string
    ): Promise<{ status: EnumTripFormResponseStatus; _count: number }[]> {
        const result = await this.databaseService.tripFormAssignment.groupBy({
            by: ['status'],
            where: { formId: formId },
            _count: true,
        });
        return result.map(r => ({ status: r.status, _count: r._count }));
    }

}
