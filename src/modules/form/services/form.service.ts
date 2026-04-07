import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
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
    IFormAssignmentWithRelations,
    IFormResponseWithAnswers,
    IFormSchemaSnapshot,
    IFormWithStructure,
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
        createdBy: string
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        const snapshot = this.buildSnapshot(
            dto.title,
            dto.description,
            dto.sections
        );

        const form = await this.formRepository.create({
            createdBy,
            kind: dto.kind,
            title: dto.title,
            description: dto.description ?? null,
            closesAt: dto.closesAt ?? null,
            status: EnumFormStatus.draft,
            schemaSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            ...(dto.tripId && { trip: { connect: { id: dto.tripId } } }),
        });

        return {
            data: { id: form.id },
            metadataActivityLog: this.formUtil.mapActivityLogMetadata(form.id),
        };
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

        const updatedForm = await this.formRepository.update(formId, {
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

        return { data: this.formUtil.mapFormOne(updatedForm) };
    }

    async publishForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        const form = await this.formRepository.findOneById(formId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }

        if (form.status === EnumFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formAlreadyPublished,
                message: 'form.error.formAlreadyPublished',
            });
        }

        if (form.status !== EnumFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotDraft,
                message: 'form.error.formNotDraft',
            });
        }

        const snapshot = form.schemaSnapshot as unknown as IFormSchemaSnapshot;

        await this.formRepository.publishWithSchema(
            formId,
            this.helperService.dateCreate(),
            (snapshot.sections ?? []).map((section, sectionIndex) => ({
                label: section.label ?? null,
                position: sectionIndex,
                questions: (section.questions ?? []).map(
                    (question, questionIndex) => ({
                        type: question.type,
                        label: question.label,
                        supportText: question.supportText ?? null,
                        placeholder: question.placeholder ?? null,
                        required: question.required,
                        position: questionIndex,
                        validation:
                            (question.validation as unknown as Prisma.InputJsonValue) ??
                            null,
                        options: question.options?.length
                            ? (question.options as unknown as Prisma.InputJsonValue)
                            : null,
                    })
                ),
            }))
        );

        return {
            data: { id: formId },
            metadataActivityLog: this.formUtil.mapActivityLogMetadata(formId),
        };
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

        const existingAssignment =
            await this.formAssignmentRepository.existByFormAndUser(
                formId,
                dto.userId
            );
        if (existingAssignment) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.responseAlreadyExists,
                message: 'form.error.responseAlreadyExists',
            });
        }

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
        return {
            data: null,
            metadataActivityLog: this.formUtil.mapActivityLogMetadata(formId),
        };
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

        if (form.status !== EnumFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotDraft,
                message: 'form.error.formNotDraft',
            });
        }

        await this.formRepository.delete(formId);
        return {
            data: null,
            metadataActivityLog: this.formUtil.mapActivityLogMetadata(formId),
        };
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
        const result =
            await this.formRepository.findWithPaginationOffsetAndCounts(
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
        const [form, counts] = await Promise.all([
            this.formRepository.existById(formId),
            this.formResponseRepository.countByFormGroupedByStatus(formId),
        ]);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }
        const assignedCount = counts.reduce((s, c) => s + c._count, 0);
        const submittedCount =
            counts.find(c => c.status === EnumFormResponseStatus.submitted)
                ?._count ?? 0;
        const pendingCount =
            counts.find(c => c.status === EnumFormResponseStatus.pending)
                ?._count ?? 0;
        const completionRate =
            assignedCount > 0 ? (submittedCount / assignedCount) * 100 : 0;

        return {
            data: {
                assignedCount,
                pendingCount,
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
        const [form, question] = await Promise.all([
            this.formRepository.existById(formId),
            this.formRepository.findQuestionByFormAndId(formId, questionId),
        ]);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.formNotFound,
                message: 'form.error.formNotFound',
            });
        }
        if (!question) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.questionNotFound,
                message: 'form.error.questionNotFound',
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
            status,
            this.helperService.dateCreate()
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
        const now = this.helperService.dateCreate();
        const { form, response } = await this.fetchAndValidateAssignment(
            assignmentId,
            formId,
            userId,
            now
        );

        return { data: this.formUtil.mapFormWithResponse(form, response) };
    }

    async submitForm(
        formId: string,
        assignmentId: string,
        dto: FormSubmitRequestDto,
        userId: string
    ): Promise<IResponseReturn<FormResponseResponseDto>> {
        const now = this.helperService.dateCreate();
        const { form, response } = await this.fetchAndValidateAssignment(
            assignmentId,
            formId,
            userId,
            now
        );

        if (form.closesAt && now > form.closesAt) {
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

        const questionIds = [
            ...new Set((dto.answers ?? []).map(answer => answer.questionId)),
        ];
        const questions =
            await this.formRepository.findManyQuestionsByFormAndIds(
                formId,
                questionIds
            );

        if (questions.length !== questionIds.length) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.questionNotFound,
                message: 'form.error.questionNotFound',
            });
        }

        const submitted = await this.formResponseRepository.upsertAnswers(
            response.id,
            formId,
            dto.answers ?? [],
            EnumFormResponseStatus.submitted,
            now
        );

        return { data: this.formUtil.mapResponseOne(submitted) };
    }

    private async fetchAndValidateAssignment(
        assignmentId: string,
        formId: string,
        userId: string,
        now: Date
    ): Promise<{
        assignment: IFormAssignmentWithRelations;
        response: IFormResponseWithAnswers;
        form: IFormWithStructure;
    }> {
        const assignment =
            await this.formAssignmentRepository.findByIdWithFormAndResponse(
                assignmentId,
                userId
            );

        if (!assignment || !assignment.isActive) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.assignmentNotFound,
                message: 'form.error.assignmentNotFound',
            });
        }

        const response = assignment.responses[0] ?? null;
        if (!response) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.responseNotFound,
                message: 'form.error.responseNotFound',
            });
        }

        if (response.formId !== formId || assignment.formId !== formId) {
            throw new NotFoundException({
                statusCode: EnumFormStatusCodeError.assignmentNotFound,
                message: 'form.error.assignmentNotFound',
            });
        }

        const form = assignment.form;
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

        if (assignment.startsAt && now < assignment.startsAt) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formNotOpenYet,
                message: 'form.error.formNotOpenYet',
            });
        }

        if (assignment.closesAt && now > assignment.closesAt) {
            throw new ConflictException({
                statusCode: EnumFormStatusCodeError.formClosed,
                message: 'form.error.formClosed',
            });
        }

        return { assignment, response, form };
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
