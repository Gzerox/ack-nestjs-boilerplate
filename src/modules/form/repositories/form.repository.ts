import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumActivityLogAction,
    EnumFormResponseStatus,
    EnumFormStatus,
    Form,
    FormQuestion,
    Prisma,
} from '@generated/prisma-client';
import {
    IFormCount,
    IFormResponseStatusCount,
    IFormWithCounts,
} from '@modules/form/interfaces/form.interface';
import { IRequestLog } from '@common/request/interfaces/request.interface';
import { DatabaseUtil } from '@common/database/utils/database.util';

@Injectable()
export class FormRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly databaseUtil: DatabaseUtil
    ) {}

    async create(
        data: Prisma.FormCreateInput,
    ): Promise<Form> {
        return this.databaseService.$transaction(async tx => {
            const form = await tx.form.create({ data });

            return form;
        });
    }

    async publishWithSchema(
        formId: string,
        publishedAt: Date,
        sections: Omit<Prisma.FormSectionCreateManyInput, 'formId'>[],
        questions: Omit<Prisma.FormQuestionCreateManyInput, 'formId'>[],
        updatedBy: string,
        requestLog: IRequestLog
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

            const form = await tx.form.update({
                where: { id: formId },
                data: { status: EnumFormStatus.published, publishedAt },
            });

            // Create activity log
            await tx.activityLog.create({
                data: {
                    userId: updatedBy,
                    action: EnumActivityLogAction.adminFormPublish,
                    ipAddress: requestLog.ipAddress,
                    userAgent: this.databaseUtil.toPlainObject(
                        requestLog.userAgent
                    ),
                    geoLocation: this.databaseUtil.toPlainObject(
                        requestLog.geoLocation
                    ),
                    createdBy: updatedBy,
                    metadata: {
                        formId: form.id,
                    },
                },
            });

            return form;
        });
    }

    async findWithPaginationOffset(
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
            include: { _count: { select: { assignments: true } } },
        });

        if (!form) {
            return null;
        }

        const [formWithCounts] = await this.attachCounts([form]);

        return formWithCounts;
    }

    async update(
        id: string,
        data: Prisma.FormUpdateInput,
        updatedBy?: string
    ): Promise<Form> {
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

    private async attachCounts(
        forms: (Form & { _count: { assignments: number } })[]
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
                    notStarted: 0,
                    submitted: 0,
                },
            ])
        );

        for (const count of groupedCounts) {
            const current = countsByForm.get(count.formId) ?? {
                notStarted: 0,
                submitted: 0,
            };

            if (count.status === EnumFormResponseStatus.notStarted) {
                current.notStarted = count._count;
            }

            if (count.status === EnumFormResponseStatus.submitted) {
                current.submitted = count._count;
            }

            countsByForm.set(count.formId, current);
        }

        return forms.map(form => ({
            id: form.id,
            createdBy: form.createdBy,
            kind: form.kind,
            title: form.title,
            description: form.description,
            status: form.status,
            schemaSnapshot: form.schemaSnapshot,
            closesAt: form.closesAt,
            publishedAt: form.publishedAt,
            createdAt: form.createdAt,
            updatedAt: form.updatedAt,
            count: this.buildCount(
                form._count.assignments,
                countsByForm.get(form.id)
            ),
        }));
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
                notStarted: 0,
                submitted: 0,
            },
        };
    }
}
