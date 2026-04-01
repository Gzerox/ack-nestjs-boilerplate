import { IPaginationIn, IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
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

export interface IFormService {
    createDraft(
        dto: FormCreateDraftRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>>;
    updateDraft(
        formId: string,
        dto: FormUpdateDraftRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<FormResponseDto>>;
    publishForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>>;
    createAssignment(
        formId: string,
        dto: FormAssignmentCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<FormAssignmentResponseDto>>;
    archiveForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<void>>;
    deleteForm(
        formId: string,
        createdBy: string
    ): Promise<IResponseReturn<void>>;
    getFormList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<FormResponseDto>>;
    getForm(
        formId: string,
        createdBy?: string
    ): Promise<IResponseReturn<FormResponseDto>>;
    getFormMetrics(
        formId: string
    ): Promise<IResponseReturn<FormMetricsResponseDto>>;
    getFormResponses(
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>>;
    getQuestionSummary(
        formId: string,
        questionId: string
    ): Promise<IResponseReturn<FormQuestionSummaryResponseDto>>;

    // User-facing
    getMyFormList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>>;
    getMyForm(
        formId: string,
        userId: string,
        assignmentId: string
    ): Promise<IResponseReturn<FormWithResponseResponseDto>>;
    submitForm(
        formId: string,
        assignmentId: string,
        dto: FormSubmitRequestDto,
        userId: string
    ): Promise<IResponseReturn<FormResponseResponseDto>>;
}
