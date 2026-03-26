import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { IRequestLog } from '@common/request/interfaces/request.interface';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { IFormService } from '@modules/form/interfaces/form.service.interface';
import { FormRepository } from '@modules/form/repositories/form.repository';
import { FormAssignmentRepository } from '@modules/form/repositories/form-assignment.repository';
import { FormResponseRepository } from '@modules/form/repositories/form-response.repository';
import { FormUtil } from '@modules/form/utils/form.util';
import { HelperService } from '@common/helper/services/helper.service';
import { EnumFormStatusCodeError } from '@modules/form/enums/form.status-code.enum';
import { FormCreateDraftRequestDto } from '@modules/form/dtos/request/form-create-draft.request.dto';
import { FormUpdateDraftRequestDto } from '@modules/form/dtos/request/form-update-draft.request.dto';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';
import { FormSubmitRequestDto } from '@modules/form/dtos/request/form-submit.request.dto';
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormCreateDraftResponseDto } from '@modules/form/dtos/response/form-create-draft.response.dto';
import { FormAssignmentResponseDto } from '@modules/form/dtos/response/form-assignment.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormWithResponseResponseDto } from '@modules/form/dtos/response/form-with-response.response.dto';
import { FormMetricsResponseDto } from '@modules/form/dtos/response/form-metrics.response.dto';
import { FormQuestionSummaryResponseDto } from '@modules/form/dtos/response/form-question-summary.response.dto';
import {
    EnumFormResponseStatus,
    EnumFormStatus,
    Prisma,
} from '@generated/prisma-client';
import { FormSchemaSectionRequestDto } from '@modules/form/dtos/request/form-schema.request.dto';
import {
    IFormResponseWithAnswers,
    IFormSchemaSnapshot,
} from '@modules/form/interfaces/form.interface';

@Injectable()
export class FormService implements IFormService {
    private readonly logger = new Logger(FormService.name);

    constructor(
        private readonly formRepository: FormRepository,
        private readonly formAssignmentRepository: FormAssignmentRepository,
        private readonly formResponseRepository: FormResponseRepository,
        private readonly formUtil: FormUtil,
        private readonly helperService: HelperService
    ) {}

    async createDraft(
        dto: FormCreateDraftRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        const snapshot = this.buildSnapshot(
            dto.title,
            dto.description,
            dto.sections
        );

        const form = await this.formRepository.create(
            {
                createdBy,
                kind: dto.kind,
                title: dto.title,
                description: dto.description ?? null,
                closesAt: dto.closesAt ?? null,
                status: EnumFormStatus.draft,
                schemaSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            },
        );

        return { data: { id: form.id } };
    }

    async updateDraft(
        formId: string,
        dto: FormUpdateDraftRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<FormResponseDto>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        if (form.status !== EnumFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotDraft,
                message: 'form.error.formNotDraft',
            });
        }

        const needsSnapshotRebuild =
            dto.title !== undefined ||
            dto.description !== undefined ||
            dto.sections !== undefined;
        const snapshot = form.schemaSnapshot as unknown as IFormSchemaSnapshot;

        const updated = await this.formRepository.update(formId, {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && {
                description: dto.description ?? null,
            }),
            ...(dto.closesAt !== undefined && { closesAt: dto.closesAt }),
            ...(needsSnapshotRebuild && {
                schemaSnapshot: this.buildSnapshot(
                    dto.title ?? form.title,
                    dto.description !== undefined
                        ? (dto.description ?? null)
                        : snapshot.description,
                    dto.sections ?? snapshot.sections
                ) as unknown as Prisma.InputJsonValue,
            }),
        });

        const updatedWithCounts = await this.formRepository.findOneByIdAndCounts(
            updated.id,
            createdBy
        );

        return { data: this.formUtil.mapFormOne(updatedWithCounts ?? updated) };
    }

    async publishForm(
        formId: string,
        createdBy: string,
        requestLog: IRequestLog
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        // TODO: Check and return error if is already published

        if (form.status !== EnumFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotDraft,
                message: 'form.error.formNotDraft',
            });
        }

        const snapshot = form.schemaSnapshot as unknown as IFormSchemaSnapshot;
        const sections: Omit<Prisma.FormSectionCreateManyInput, 'formId'>[] = (
            snapshot.sections ?? []
        ).map((s, i: number) => ({
            sectionId: s.id,
            label: s.label ?? null,
            position: i,
        }));

        const questions: Omit<Prisma.FormQuestionCreateManyInput, 'formId'>[] =
            (snapshot.sections ?? []).flatMap(s =>
                (s.questions ?? []).map((q, qi: number) => ({
                    sectionId: s.id,
                    questionId: q.id,
                    type: q.type,
                    label: q.label,
                    required: q.required,
                    position: qi,
                    validation:
                        (q.validation as unknown as Prisma.InputJsonValue) ??
                        null,
                    options:
                        q.options?.length
                            ? (q.options as unknown as Prisma.InputJsonValue)
                            : null,
                }))
            );

        await this.formRepository.publishWithSchema(
            formId,
            this.helperService.dateCreate(),
            sections,
            questions,
            createdBy,
            requestLog
        );

        return { data: { id: formId } };
    }

    async createAssignment(
        formId: string,
        dto: FormAssignmentCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<FormAssignmentResponseDto>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        //TODO: Check if the form already has an assignment for dto.audienceId
        // If it does, raise error. In assignment model: formId-userId should be unique.

        if (form.status !== EnumFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotPublished,
                message: 'form.error.formNotPublished',
            });
        }

        const assignment =
            await this.formAssignmentRepository.createWithResponse(formId, dto);

        return { data: this.formUtil.mapAssignmentOne(assignment) };
    }

    async archiveForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<void>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        if (form.status !== EnumFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotPublished,
                message: 'form.error.formNotPublished',
            });
        }

        await this.formRepository.archive(formId);
        return { data: null };
    }

    async deleteForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<void>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        await this.formRepository.delete(formId);
        return { data: null };
    }

    async getFormList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<FormResponseDto>> {
        const result = await this.formRepository.findWithPaginationOffsetAndCounts(
            pagination,
            status,
            kind,
            createdBy
        );

        return {
            ...result,
            data: this.formUtil.mapFormList(result.data),
        } as IResponsePagingReturn<FormResponseDto>;
    }

    async getForm(
        formId: string,
        createdBy?: string
    ): Promise<IResponseReturn<FormResponseDto>> {
        const form = await this.formRepository.findOneByIdAndCounts(
            formId,
            createdBy
        );
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }
        return { data: this.formUtil.mapFormOne(form) };
    }

    async getFormMetrics(
        formId: string
    ): Promise<IResponseReturn<FormMetricsResponseDto>> {
        const form = await this.formRepository.existById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        const counts =
            await this.formResponseRepository.countByFormGroupedByStatus(
                formId
            );
        const assignedCount = counts.reduce((s, c) => s + c._count, 0);
        const submittedCount =
            counts.find(c => c.status === EnumFormResponseStatus.submitted)
                ?._count ?? 0;
        const notStartedCount =
            counts.find(c => c.status === EnumFormResponseStatus.notStarted)
                ?._count ?? 0;
        const completionRate =
            assignedCount > 0 ? (submittedCount / assignedCount) * 100 : 0;

        return {
            data: {
                assignedCount,
                notStartedCount,
                submittedCount,
                completionRate: Math.round(completionRate * 100) / 100,
            },
        };
    }

    async getFormResponses(
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>> {
        const form = await this.formRepository.existById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        const result = await this.formResponseRepository.findManyByForm(
            formId,
            pagination
        );
        return {
            ...result,
            data: this.formUtil.mapResponseList(
                result.data as IFormResponseWithAnswers[]
            ),
        } as IResponsePagingReturn<FormResponseResponseDto>;
    }

    async getQuestionSummary(
        formId: string,
        questionId: string
    ): Promise<IResponseReturn<FormQuestionSummaryResponseDto>> {
        const form = await this.formRepository.existById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        const question = await this.formRepository.findQuestionByFormAndId(
            formId,
            questionId
        );
        if (!question) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.responseNotFound,
                message: 'form.error.responseNotFound',
            });
        }

        const answers =
            await this.formResponseRepository.aggregateAnswersByQuestion(
                formId,
                questionId
            );
        return {
            data: this.formUtil.buildQuestionSummary(
                answers,
                questionId,
                question.type
            ),
        };
    }

    // User-facing
    async getMyFormList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>> {
        const result = await this.formResponseRepository.findManyByUser(
            userId,
            pagination,
            status
        );
        return {
            ...result,
            data: this.formUtil.mapResponseList(
                result.data as IFormResponseWithAnswers[]
            ),
        } as IResponsePagingReturn<FormResponseResponseDto>;
    }

    async getMyForm(
        formId: string,
        userId: string,
        assignmentId: string
    ): Promise<IResponseReturn<FormWithResponseResponseDto>> {
        const response =
            await this.formResponseRepository.findByAssignmentAndUser(
                assignmentId,
                userId
            );
        if (!response) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.responseNotFound,
                message: 'form.error.responseNotFound',
            });
        }

        const form = await this.formRepository.findOneById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        return {
            data: this.formUtil.mapFormWithResponse(form, response),
        };
    }

    async submitForm(
        formId: string,
        dto: FormSubmitRequestDto,
        userId: string
    ): Promise<IResponseReturn<FormResponseResponseDto>> {
        const response =
            await this.formResponseRepository.findByAssignmentAndUser(
                dto.assignmentId,
                userId
            );
        if (!response) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.responseNotFound,
                message: 'form.error.responseNotFound',
            });
        }

        const assignment = await this.formAssignmentRepository.findById(
            dto.assignmentId
        );
        if (!assignment || !assignment.isActive) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.assignmentNotFound,
                message: 'form.error.assignmentNotFound',
            });
        }

        if (
            assignment.closesAt &&
            this.helperService.dateCreate() > assignment.closesAt
        ) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formClosed,
                message: 'form.error.formClosed',
            });
        }

        const form = await this.formRepository.findOneById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        if (form.status !== EnumFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotPublished,
                message: 'form.error.formNotPublished',
            });
        }

        if (form.closesAt && this.helperService.dateCreate() > form.closesAt) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formClosed,
                message: 'form.error.formClosed',
            });
        }

        if (response.status === EnumFormResponseStatus.submitted) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.responseAlreadySubmitted,
                message: 'form.error.responseAlreadySubmitted',
            });
        }

        const submitted = await this.formResponseRepository.upsertAnswers(
            response.id,
            formId,
            dto.answers ?? [],
            EnumFormResponseStatus.submitted,
            this.helperService.dateCreate()
        );

        return { data: this.formUtil.mapResponseOne(submitted) };
    }

    private buildSnapshot(
        title: string,
        description: string | null | undefined,
        sections: FormSchemaSectionRequestDto[]
    ): IFormSchemaSnapshot {
        return {
            title,
            description: description ?? null,
            sections,
        };
    }

}
