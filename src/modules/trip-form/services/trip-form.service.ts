import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { ITripFormService } from '@modules/trip-form/interfaces/trip-form.service.interface';
import { TripFormRepository } from '@modules/trip-form/repositories/trip-form.repository';
import { TripFormAssignmentRepository } from '@modules/trip-form/repositories/trip-form-assignment.repository';
import { TripFormUtil } from '@modules/trip-form/utils/trip-form.util';
import { HelperService } from '@common/helper/services/helper.service';
import { EnumTripFormStatusCodeError } from '@modules/trip-form/enums/trip-form.status-code.enum';
import { TripFormCreateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-draft.request.dto';
import { TripFormUpdateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-update-draft.request.dto';
import { TripFormCreateFromTemplateRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-from-template.request.dto';
import { TripFormAssignmentCreateRequestDto } from '@modules/trip-form/dtos/request/trip-form-assignment-create.request.dto';
import { TripFormSubmitRequestDto } from '@modules/trip-form/dtos/request/trip-form-submit.request.dto';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormCreateDraftResponseDto } from '@modules/trip-form/dtos/response/trip-form-create-draft.response.dto';
import { TripFormAssignmentResponseDto } from '@modules/trip-form/dtos/response/trip-form-assignment.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormWithResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-with-response.response.dto';
import { TripFormMetricsResponseDto } from '@modules/trip-form/dtos/response/trip-form-metrics.response.dto';
import {
    EnumTripFormResponseStatus,
    EnumTripFormStatus,
    Prisma,
} from '@generated/prisma-client';
import {
    ITripFormAssignmentWithRelations,
    ITripFormWithStructure,
} from '@modules/trip-form/interfaces/trip-form.interface';

@Injectable()
export class TripFormService implements ITripFormService {
    constructor(
        private readonly tripFormRepository: TripFormRepository,
        private readonly tripFormAssignmentRepository: TripFormAssignmentRepository,
        private readonly tripFormUtil: TripFormUtil,
        private readonly helperService: HelperService
    ) {}

    async createFromTemplate(
        dto: TripFormCreateFromTemplateRequestDto,
        tripId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        const tripExists = await this.tripFormRepository.existTripById(tripId);
        if (!tripExists) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.tripNotFound,
                message: 'trip-form.error.tripNotFound',
            });
        }

        const form = await this.tripFormRepository.createFromTemplate(dto, tripId, createdBy);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.templateNotFound,
                message: 'trip-form.error.templateNotFound',
            });
        }

        return {
            data: { id: form.id },
            metadataActivityLog: this.tripFormUtil.mapActivityLogMetadata(form.id),
        };
    }

    async createDraft(
        dto: TripFormCreateDraftRequestDto,
        tripId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        const tripExists = await this.tripFormRepository.existTripById(tripId);
        if (!tripExists) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.tripNotFound,
                message: 'trip-form.error.tripNotFound',
            });
        }

        try {
            const form = await this.tripFormRepository.create(dto, tripId, createdBy);

            return {
                data: { id: form.id },
                metadataActivityLog: this.tripFormUtil.mapActivityLogMetadata(form.id),
            };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.createDraft',
                    tripId,
                },
                _error: error,
            });
        }
    }

    async updateDraft(
        tripId: string,
        formId: string,
        dto: TripFormUpdateDraftRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<TripFormResponseDto>> {
        const form = await this.tripFormRepository.findOneById(formId, tripId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        if (form.status !== EnumTripFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotDraft,
                message: 'trip-form.error.formNotDraft',
            });
        }

        try {
            const updatedForm = await this.tripFormRepository.update(formId, dto, updatedBy, form);

            return { data: this.tripFormUtil.mapFormOne(updatedForm) };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.updateDraft',
                    formId,
                },
                _error: error,
            });
        }
    }

    async publishForm(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        const form = await this.tripFormRepository.findOneById(formId, tripId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        if (form.status === EnumTripFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formAlreadyPublished,
                message: 'trip-form.error.formAlreadyPublished',
            });
        }

        if (form.status !== EnumTripFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotDraft,
                message: 'trip-form.error.formNotDraft',
            });
        }

        const snapshot = this.tripFormUtil.normalizeSchemaSnapshot(form);

        try {
            await this.tripFormRepository.publishWithSchema(
                formId,
                this.helperService.dateCreate(),
                this.tripFormUtil.buildPublishSections(snapshot.sections ?? [])
            );

            return {
                data: { id: formId },
                metadataActivityLog: this.tripFormUtil.mapActivityLogMetadata(formId),
            };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.publishForm',
                    formId,
                },
                _error: error,
            });
        }
    }

    async createAssignment(
        tripId: string,
        formId: string,
        dto: TripFormAssignmentCreateRequestDto
    ): Promise<IResponseReturn<TripFormAssignmentResponseDto>> {
        const form = await this.tripFormRepository.findOneById(formId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }
        if (form.tripId !== tripId) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        const existingAssignment =
            await this.tripFormAssignmentRepository.existByFormAndUser(
                formId,
                dto.userId
            );
        if (existingAssignment) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.responseAlreadyExists,
                message: 'trip-form.error.responseAlreadyExists',
            });
        }

        if (form.status !== EnumTripFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotPublished,
                message: 'trip-form.error.formNotPublished',
            });
        }

        try {
            const assignment =
                await this.tripFormAssignmentRepository.create(
                    formId,
                    tripId,
                    dto
                );

            return { data: this.tripFormUtil.mapAssignmentOne(assignment) };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.createAssignment',
                    formId,
                    tripId,
                },
                _error: error,
            });
        }
    }

    async archiveForm(
        tripId: string,
        formId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
        const form = await this.tripFormRepository.findOneById(formId, tripId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        if (form.status !== EnumTripFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotPublished,
                message: 'trip-form.error.formNotPublished',
            });
        }

        try {
            await this.tripFormRepository.archive(formId, updatedBy);
            return {
                data: null,
                metadataActivityLog: this.tripFormUtil.mapActivityLogMetadata(
                    formId
                ),
            };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.archiveForm',
                    formId,
                },
                _error: error,
            });
        }
    }

    async deleteForm(
        tripId: string,
        formId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>> {
        const form = await this.tripFormRepository.findOneById(formId, tripId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        if (form.status !== EnumTripFormStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotDraft,
                message: 'trip-form.error.formNotDraft',
            });
        }

        try {
            await this.tripFormRepository.softDelete(formId, deletedBy);
            return {
                data: null,
                metadataActivityLog: this.tripFormUtil.mapActivityLogMetadata(
                    formId
                ),
            };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.deleteForm',
                    formId,
                },
                _error: error,
            });
        }
    }

    async getFormList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormSelect,
            Prisma.TripFormWhereInput
        >,
        tripId: string,
        status?: Record<string, IPaginationIn>,
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseDto>> {
        const result =
            await this.tripFormRepository.findWithPaginationOffsetAndCounts(
                pagination,
                tripId,
                status,
                kind
            );

        return {
            ...result,
            data: this.tripFormUtil.mapFormList(result.data),
        };
    }

    async getForm(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormResponseDto>> {
        const form = await this.tripFormRepository.findOneByIdAndCounts(
            formId,
            tripId
        );
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }
        return { data: this.tripFormUtil.mapFormOne(form) };
    }

    async getFormMetrics(
        tripId: string,
        formId: string
    ): Promise<IResponseReturn<TripFormMetricsResponseDto>> {
        const [form, counts] = await Promise.all([
            this.tripFormRepository.existById(formId, tripId),
            this.tripFormAssignmentRepository.countByFormGroupedByStatus(formId),
        ]);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }
        const assignedCount = counts.reduce((s, c) => s + c._count, 0);
        const submittedCount =
            counts.find(c => c.status === EnumTripFormResponseStatus.submitted)
                ?._count ?? 0;
        const pendingCount =
            counts.find(c => c.status === EnumTripFormResponseStatus.pending)
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
        tripId: string,
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>> {
        const form = await this.tripFormRepository.existById(formId, tripId);
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        const result = await this.tripFormAssignmentRepository.findManyByForm(
            formId,
            pagination
        );
        return {
            ...result,
            data: this.tripFormUtil.mapResponseList(result.data),
        };
    }

    // User-facing
    async getMyFormList(
        userId: string,
        tripId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>> {
        const result = await this.tripFormAssignmentRepository.findManyByUser(
            userId,
            tripId,
            pagination,
            status,
            this.helperService.dateCreate()
        );
        return {
            ...result,
            data: this.tripFormUtil.mapResponseList(result.data),
        };
    }

    async getMyForm(
        tripId: string,
        formId: string,
        userId: string,
        assignmentId: string
    ): Promise<IResponseReturn<TripFormWithResponseResponseDto>> {
        const now = this.helperService.dateCreate();
        const { assignment, form } = await this.fetchAndValidateAssignment(
            assignmentId,
            tripId,
            formId,
            userId,
            now
        );

        return { data: this.tripFormUtil.mapFormWithResponse(form, assignment) };
    }

    async submitForm(
        tripId: string,
        formId: string,
        assignmentId: string,
        dto: TripFormSubmitRequestDto,
        userId: string
    ): Promise<IResponseReturn<TripFormResponseResponseDto>> {
        const now = this.helperService.dateCreate();
        const { assignment, form } = await this.fetchAndValidateAssignment(
            assignmentId,
            tripId,
            formId,
            userId,
            now
        );

        if (form.closesAt && now > form.closesAt) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formClosed,
                message: 'trip-form.error.formClosed',
            });
        }

        if (assignment.status === EnumTripFormResponseStatus.submitted) {
            throw new ConflictException({
                statusCode:
                    EnumTripFormStatusCodeError.responseAlreadySubmitted,
                message: 'trip-form.error.responseAlreadySubmitted',
            });
        }

        const answerQuestionIds = (dto.answers ?? []).map(
            answer => answer.questionId
        );
        const questionIds = [...new Set(answerQuestionIds)];
        if (questionIds.length !== answerQuestionIds.length) {
            throw new BadRequestException({
                statusCode:
                    EnumTripFormStatusCodeError.responseQuestionDuplicate,
                message: 'trip-form.error.responseQuestionDuplicate',
            });
        }

        const questions =
            await this.tripFormRepository.findManyQuestionsByFormAndIds(
                formId,
                questionIds
            );

        if (questions.length !== questionIds.length) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.questionNotFound,
                message: 'trip-form.error.questionNotFound',
            });
        }

        /**
         * TODO: Before actually saving the response-submit, we shall validated if all the answers respect the validation & required mechanism
         *  TripFormQuestion.required = true - the TripFormSubmitRequestDto should contain a response for that specific questions
         *  TripFormQuestion.validations - if any validation are present, we should validate the answer respect those validation
         *      (ex: if the question is a number, we should validate that the answer is a number and respect the min/max if any)
         */
        try {
            const submitted = await this.tripFormAssignmentRepository.submit(
                assignment.id,
                formId,
                dto.answers ?? [],
                now
            );

            return { data: this.tripFormUtil.mapResponseOne(submitted) };
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip-form.submitForm',
                    formId,
                    assignmentId,
                },
                _error: error,
            });
        }
    }

    private async fetchAndValidateAssignment(
        assignmentId: string,
        tripId: string,
        formId: string,
        userId: string,
        now: Date
    ): Promise<{
        assignment: ITripFormAssignmentWithRelations;
        form: ITripFormWithStructure;
    }> {
        const assignment =
            await this.tripFormAssignmentRepository.findByIdWithFormAndAnswers(
                assignmentId,
                userId,
                tripId
            );

        if (!assignment || !assignment.isActive) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.assignmentNotFound,
                message: 'trip-form.error.assignmentNotFound',
            });
        }

        if (assignment.formId !== formId) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.assignmentNotFound,
                message: 'trip-form.error.assignmentNotFound',
            });
        }

        const form = assignment.form;
        if (!form) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }
        if (form.tripId !== tripId) {
            throw new NotFoundException({
                statusCode: EnumTripFormStatusCodeError.formNotFound,
                message: 'trip-form.error.formNotFound',
            });
        }

        if (form.status !== EnumTripFormStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotPublished,
                message: 'trip-form.error.formNotPublished',
            });
        }

        if (assignment.startsAt && now < assignment.startsAt) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formNotOpenYet,
                message: 'trip-form.error.formNotOpenYet',
            });
        }

        if (assignment.closesAt && now > assignment.closesAt) {
            throw new ConflictException({
                statusCode: EnumTripFormStatusCodeError.formClosed,
                message: 'trip-form.error.formClosed',
            });
        }

        return { assignment, form };
    }

}
