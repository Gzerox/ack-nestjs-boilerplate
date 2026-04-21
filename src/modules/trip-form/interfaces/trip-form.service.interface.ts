import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponseFileReturn,
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { TripFormCreateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-draft.request.dto';
import { TripFormCreateFromTemplateRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-from-template.request.dto';
import { TripFormUpdateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-update-draft.request.dto';
import { TripFormAssignmentCreateRequestDto } from '@modules/trip-form/dtos/request/trip-form-assignment-create.request.dto';
import { TripFormSubmitRequestDto } from '@modules/trip-form/dtos/request/trip-form-submit.request.dto';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormCreateDraftResponseDto } from '@modules/trip-form/dtos/response/trip-form-create-draft.response.dto';
import { TripFormAssignmentResponseDto } from '@modules/trip-form/dtos/response/trip-form-assignment.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormWithResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-with-response.response.dto';
import { TripFormMetricsResponseDto } from '@modules/trip-form/dtos/response/trip-form-metrics.response.dto';

export interface ITripFormService {
    createFromTemplate(
        dto: TripFormCreateFromTemplateRequestDto,
        tripId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>>;
    createDraft(
        dto: TripFormCreateDraftRequestDto,
        tripId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>>;
    updateDraft(
        tripId: string,
        formId: string,
        dto: TripFormUpdateDraftRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<TripFormResponseDto>>;
    publishForm(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>>;
    createAssignment(
        tripId: string,
        formId: string,
        dto: TripFormAssignmentCreateRequestDto
    ): Promise<IResponseReturn<TripFormAssignmentResponseDto>>;
    archiveForm(
        tripId: string,
        formId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>>;
    deleteForm(
        tripId: string,
        formId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>>;
    getFormList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormSelect,
            Prisma.TripFormWhereInput
        >,
        tripId: string,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseDto>>;
    getForm(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormResponseDto>>;
    getFormMetrics(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormMetricsResponseDto>>;
    getFormResponses(
        tripId: string,
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>>;
    exportFormResponsesCsv(
        tripId: string,
        formId: string
    ): Promise<IResponseFileReturn>;

    // User-facing
    getMyFormList(
        userId: string,
        tripId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>>;
    getMyForm(
        tripId: string,
        formId: string,
        userId: string,
        assignmentId: string
    ): Promise<IResponseReturn<TripFormWithResponseResponseDto>>;
    submitForm(
        tripId: string,
        formId: string,
        assignmentId: string,
        dto: TripFormSubmitRequestDto,
        userId: string
    ): Promise<IResponseReturn<TripFormResponseResponseDto>>;
}
