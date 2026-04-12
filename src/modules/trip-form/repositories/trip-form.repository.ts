import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperService } from '@common/helper/services/helper.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumTripFormQuestionType,
    EnumTripFormResponseStatus,
    EnumTripFormStatus,
    Prisma,
    TripForm,
    TripFormQuestion,
    TripFormSection,
} from '@generated/prisma-client';
import {
    ITripFormCount,
    ITripFormResponseStatusCount,
    ITripFormWithCounts,
    ITripFormWithStructure,
} from '@modules/trip-form/interfaces/trip-form.interface';
import { TripFormCreateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-draft.request.dto';
import { TripFormUpdateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-update-draft.request.dto';
import { TripFormUtil } from '@modules/trip-form/utils/trip-form.util';

@Injectable()
export class TripFormRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly helperService: HelperService,
        private readonly tripFormUtil: TripFormUtil
    ) {}

    async create(
        dto: TripFormCreateDraftRequestDto,
        tripId: string,
        createdBy: string
    ): Promise<TripForm> {
        return this.databaseService.tripForm.create({
            data: {
                createdBy,
                kind: dto.kind,
                title: dto.title,
                description: dto.description ?? null,
                closesAt: dto.closesAt ?? null,
                status: EnumTripFormStatus.draft,
                schemaSnapshot: this.tripFormUtil.buildSchemaSnapshot(
                    dto.title,
                    dto.description,
                    dto.sections
                ) as unknown as Prisma.InputJsonValue,
                trip: { connect: { id: tripId } },
                deletedAt: null,
            },
        });
    }

    async existTripById(id: string): Promise<boolean> {
        const trip = await this.databaseService.trip.findUnique({
            where: { id },
            select: { id: true },
        });

        return !!trip;
    }

    async publishWithSchema(
        formId: string,
        publishedAt: Date,
        sections: Array<{
            label: string | null;
            position: number;
            questions: Array<{
                type: EnumTripFormQuestionType;
                label: string;
                supportText?: string | null;
                placeholder?: string | null;
                required: boolean;
                position: number;
                validation?: Prisma.InputJsonValue | null;
                options?: Prisma.InputJsonValue | null;
            }>;
        }>
    ): Promise<TripForm> {
        return this.databaseService.$transaction(async tx => {
            await Promise.all([
                tx.tripFormSection.deleteMany({ where: { formId: formId } }),
                tx.tripFormQuestion.deleteMany({ where: { formId: formId } }),
            ]);

            const createdSections: TripFormSection[] = [];
            for (const section of sections) {
                createdSections.push(
                    await tx.tripFormSection.create({
                        data: {
                            formId: formId,
                            label: section.label,
                            position: section.position,
                        },
                    })
                );
            }

            const allQuestions = sections.flatMap((section, sectionIndex) =>
                section.questions.map(question => ({
                    formId: formId,
                    sectionId: createdSections[sectionIndex].id,
                    type: question.type,
                    label: question.label,
                    supportText: question.supportText ?? null,
                    placeholder: question.placeholder ?? null,
                    required: question.required,
                    position: question.position,
                    validation: question.validation ?? null,
                    options: question.options ?? null,
                }))
            );

            if (allQuestions.length > 0) {
                await tx.tripFormQuestion.createMany({ data: allQuestions });
            }

            return tx.tripForm.update({
                where: { id: formId },
                data: { status: EnumTripFormStatus.published, publishedAt },
            });
        });
    }

    async findWithPaginationOffsetAndCounts(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormSelect,
            Prisma.TripFormWhereInput
        >,
        tripId: string,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<ITripFormWithCounts>> {
        const result = await this.paginationService.offset<
            TripForm & { _count: { assignments: number } },
            Prisma.TripFormSelect,
            Prisma.TripFormWhereInput
        >(this.databaseService.tripForm, {
            ...pagination,
            where: {
                ...pagination.where,
                tripId,
                deletedAt: null,
                ...status,
                ...kind,
            },
            include: { _count: { select: { assignments: true } } },
        });

        return {
            ...result,
            data: await this.attachCounts(result.data),
        };
    }

    async findOneById(id: string, tripId?: string): Promise<TripForm | null> {
        return this.databaseService.tripForm.findFirst({
            where: {
                id,
                deletedAt: null,
                ...(tripId && { tripId }),
            },
        });
    }

    async findOneByIdAndCounts(
        id: string,
        tripId?: string
    ): Promise<ITripFormWithCounts | null> {
        const form = await this.databaseService.tripForm.findFirst({
            where: {
                id,
                deletedAt: null,
                ...(tripId && { tripId }),
            },
            include: {
                sections: true,
                questions: true,
                _count: { select: { assignments: true } },
            },
        });

        if (!form) {
            return null;
        }

        const [formWithCounts] = await this.attachCounts([form]);

        return formWithCounts;
    }

    async update(
        formId: string,
        dto: TripFormUpdateDraftRequestDto,
        updatedBy: string,
        currentForm: TripForm
    ): Promise<TripForm> {
        const needsSnapshotRebuild =
            dto.title !== undefined ||
            dto.description !== undefined ||
            dto.sections !== undefined;
        const snapshot = this.tripFormUtil.normalizeSchemaSnapshot(currentForm);
        const nextTitle = dto.title ?? currentForm.title;
        const nextDescription =
            dto.description !== undefined
                ? (dto.description ?? null)
                : snapshot.description ?? null;
        const nextSections = dto.sections ?? snapshot.sections;

        return this.databaseService.tripForm.update({
            where: { id: formId },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.description !== undefined && {
                    description: dto.description ?? null,
                }),
                ...(dto.closesAt !== undefined && { closesAt: dto.closesAt }),
                ...(needsSnapshotRebuild && {
                    schemaSnapshot: this.tripFormUtil.buildSchemaSnapshot(
                        nextTitle,
                        nextDescription,
                        nextSections
                    ) as unknown as Prisma.InputJsonValue,
                }),
                updatedBy,
            },
        });
    }

    async archive(id: string, updatedBy: string): Promise<TripForm> {
        return this.databaseService.tripForm.update({
            where: { id },
            data: { status: EnumTripFormStatus.archived, updatedBy },
        });
    }

    async softDelete(id: string, deletedBy: string): Promise<TripForm> {
        return this.databaseService.tripForm.update({
            where: { id },
            data: {
                deletedAt: this.helperService.dateCreate(),
                deletedBy,
                updatedBy: deletedBy,
            },
        });
    }

    async existById(id: string, tripId?: string): Promise<{ id: string } | null> {
        return this.databaseService.tripForm.findFirst({
            where: {
                id,
                deletedAt: null,
                ...(tripId && { tripId }),
            },
            select: { id: true },
        });
    }

    async findManyQuestionsByFormAndIds(
        formId: string,
        questionIds: string[]
    ): Promise<TripFormQuestion[]> {
        if (questionIds.length === 0) {
            return [];
        }

        return this.databaseService.tripFormQuestion.findMany({
            where: {
                formId: formId,
                id: {
                    in: questionIds,
                },
            },
        });
    }

    private async attachCounts(
        forms: (ITripFormWithStructure & { _count: { assignments: number } })[]
    ): Promise<ITripFormWithCounts[]> {
        if (forms.length === 0) {
            return [];
        }

        const groupedCounts = await this.databaseService.tripFormAssignment.groupBy(
            {
                by: ['formId', 'status'],
                where: {
                    formId: {
                        in: forms.map(form => form.id),
                    },
                },
                _count: true,
            }
        );

        const countsByForm = new Map<string, ITripFormResponseStatusCount>(
            forms.map(form => [
                form.id,
                {
                    pending: 0,
                    submitted: 0,
                },
            ])
        );

        for (const count of groupedCounts) {
            const current = countsByForm.get(count.formId) ?? {
                pending: 0,
                submitted: 0,
            };

            if (count.status === EnumTripFormResponseStatus.pending) {
                current.pending = count._count;
            }

            if (count.status === EnumTripFormResponseStatus.submitted) {
                current.submitted = count._count;
            }

            countsByForm.set(count.formId, current);
        }

        return forms.map(form => {
            const { _count, ...rest } = form;

            return {
                ...rest,
                count: this.buildCount(
                    form._count.assignments,
                    countsByForm.get(form.id)
                ),
            };
        });
    }

    private buildCount(
        assignments: number,
        response?: ITripFormResponseStatusCount
    ): ITripFormCount {
        return {
            assignment: {
                assignments,
            },
            response: response ?? {
                pending: 0,
                submitted: 0,
            },
        };
    }

}
