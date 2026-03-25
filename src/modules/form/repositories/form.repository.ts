import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumFormStatus,
    Form,
    FormQuestion,
    Prisma,
} from '@generated/prisma-client';

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
        sections: Omit<Prisma.FormSectionCreateManyInput, 'formId'>[],
        questions: Omit<Prisma.FormQuestionCreateManyInput, 'formId'>[]
    ): Promise<Form> {
        return this.databaseService.$transaction(async tx => {
            // Delete any previously materialized sections/questions (idempotent publish)
            await tx.formSection.deleteMany({ where: { formId } });
            await tx.formQuestion.deleteMany({ where: { formId } });

            if (sections.length > 0) {
                await tx.formSection.createMany({
                    data: sections.map(s => ({ ...s, formId })),
                });
            }
            if (questions.length > 0) {
                await tx.formQuestion.createMany({
                    data: questions.map(q => ({ ...q, formId })),
                });
            }

            return tx.form.update({
                where: { id: formId },
                data: { status: EnumFormStatus.published, publishedAt },
            });
        });
    }

    async findMany(
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<Form>> {
        return this.paginationService.offset<
            Form,
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
        });
    }

    async findById(id: string, createdBy?: string): Promise<Form | null> {
        return this.databaseService.form.findFirst({
            where: { id, ...(createdBy && { createdBy }) },
            include: { _count: { select: { assignments: true } } },
        }) as Promise<Form | null>;
    }

    async update(id: string, data: Prisma.FormUpdateInput): Promise<Form> {
        return this.databaseService.form.update({
            where: { id },
            data,
            include: { _count: { select: { assignments: true } } },
        }) as Promise<Form>;
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
        return this.databaseService.formQuestion.findUnique({
            where: { formId_questionId: { formId, questionId } },
        });
    }
}
