import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumFormQuestionType,
    EnumFormResponseStatus,
    EnumFormStatus,
    Form,
    FormQuestion,
    FormSection,
    Prisma,
} from '@generated/prisma-client';
import {
    IFormCount,
    IFormResponseStatusCount,
    IFormWithStructure,
    IFormWithCounts,
} from '@modules/form/interfaces/form.interface';

@Injectable()
export class FormRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(data: Prisma.FormCreateInput): Promise<Form> {
        return this.databaseService.form.create({ data });
    }

    async publishWithSchema(
        formId: string,
        publishedAt: Date,
        sections: Array<{
            label: string | null;
            position: number;
            questions: Array<{
                type: EnumFormQuestionType;
                label: string;
                supportText?: string | null;
                placeholder?: string | null;
                required: boolean;
                position: number;
                validation?: Prisma.InputJsonValue | null;
                options?: Prisma.InputJsonValue | null;
            }>;
        }>
    ): Promise<Form> {
        return this.databaseService.$transaction(async tx => {
            await Promise.all([
                tx.formSection.deleteMany({ where: { formId } }),
                tx.formQuestion.deleteMany({ where: { formId } }),
            ]);

            const createdSections: FormSection[] = [];
            for (const section of sections) {
                createdSections.push(
                    await tx.formSection.create({
                        data: {
                            formId,
                            label: section.label,
                            position: section.position,
                        },
                    })
                );
            }

            const allQuestions = sections.flatMap((section, sectionIndex) =>
                section.questions.map(question => ({
                    formId,
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
                await tx.formQuestion.createMany({ data: allQuestions });
            }

            return tx.form.update({
                where: { id: formId },
                data: { status: EnumFormStatus.published, publishedAt },
            });
        });
    }

    async findWithPaginationOffsetAndCounts(
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<IFormWithCounts>> {
        const result = await this.paginationService.offset<
            Form & { _count: { assignments: number } },
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >(this.databaseService.form, {
            ...pagination,
            where: {
                ...pagination.where,
                ...status,
                ...kind,
                ...(createdBy && { createdBy }),
            },
            include: { _count: { select: { assignments: true } } },
        });

        return {
            ...result,
            data: await this.attachCounts(result.data),
        };
    }

    async findOneById(id: string, createdBy?: string): Promise<Form | null> {
        return this.databaseService.form.findFirst({
            where: { id, ...(createdBy && { createdBy }) },
        });
    }

    async findOneByIdAndCounts(
        id: string,
        createdBy?: string
    ): Promise<IFormWithCounts | null> {
        const form = await this.databaseService.form.findFirst({
            where: { id, ...(createdBy && { createdBy }) },
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

    async update(id: string, data: Prisma.FormUpdateInput): Promise<Form> {
        return this.databaseService.form.update({
            where: { id },
            data,
        });
    }

    async archive(id: string): Promise<Form> {
        return this.databaseService.form.update({
            where: { id },
            data: { status: EnumFormStatus.archived },
        });
    }

    async delete(id: string): Promise<Form> {
        return this.databaseService.form.delete({ where: { id } });
    }

    async existById(id: string): Promise<{ id: string } | null> {
        return this.databaseService.form.findUnique({
            where: { id },
            select: { id: true },
        });
    }

    async findQuestionByFormAndId(
        formId: string,
        questionId: string
    ): Promise<FormQuestion | null> {
        return this.databaseService.formQuestion.findFirst({
            where: { id: questionId, formId },
        });
    }

    async findManyQuestionsByFormAndIds(
        formId: string,
        questionIds: string[]
    ): Promise<FormQuestion[]> {
        if (questionIds.length === 0) {
            return [];
        }

        return this.databaseService.formQuestion.findMany({
            where: {
                formId,
                id: {
                    in: questionIds,
                },
            },
        });
    }

    private async attachCounts(
        forms: (IFormWithStructure & { _count: { assignments: number } })[]
    ): Promise<IFormWithCounts[]> {
        if (forms.length === 0) {
            return [];
        }

        const groupedCounts = await this.databaseService.formResponse.groupBy({
            by: ['formId', 'status'],
            where: {
                formId: {
                    in: forms.map(form => form.id),
                },
            },
            _count: true,
        });

        const countsByForm = new Map<string, IFormResponseStatusCount>(
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

            if (count.status === EnumFormResponseStatus.pending) {
                current.pending = count._count;
            }

            if (count.status === EnumFormResponseStatus.submitted) {
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
        response?: IFormResponseStatusCount
    ): IFormCount {
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
