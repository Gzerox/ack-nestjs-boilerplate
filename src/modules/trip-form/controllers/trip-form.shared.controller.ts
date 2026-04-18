import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { AuthJwtAccessProtected } from '@modules/auth/decorators/auth.jwt.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import {
    EnumActivityLogAction,
    EnumTripFormKind,
    EnumTripFormStatus,
    Prisma,
} from '@generated/prisma-client';
import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { TripFormService } from '@modules/trip-form/services/trip-form.service';
import { TripFormCreateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-draft.request.dto';
import { TripFormCreateFromTemplateRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-from-template.request.dto';
import { TripFormUpdateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-update-draft.request.dto';
import { TripFormAssignmentCreateRequestDto } from '@modules/trip-form/dtos/request/trip-form-assignment-create.request.dto';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormCreateDraftResponseDto } from '@modules/trip-form/dtos/response/trip-form-create-draft.response.dto';
import { TripFormAssignmentResponseDto } from '@modules/trip-form/dtos/response/trip-form-assignment.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormMetricsResponseDto } from '@modules/trip-form/dtos/response/trip-form-metrics.response.dto';
import {
    TripFormSharedArchiveDoc,
    TripFormSharedCreateAssignmentDoc,
    TripFormSharedCreateDraftDoc,
    TripFormSharedCreateFromTemplateDoc,
    TripFormSharedDeleteDoc,
    TripFormSharedGetDoc,
    TripFormSharedListDoc,
    TripFormSharedMetricsDoc,
    TripFormSharedPublishDoc,
    TripFormSharedResponsesDoc,
    TripFormSharedUpdateDraftDoc,
} from '@modules/trip-form/docs/trip-form.shared.doc';
import {
    TRIP_FORM_TAG_SHARED,
    TripFormAvailableKind,
    TripFormAvailableStatus,
    TripFormDefaultAvailableSearch,
    TripFormDefaultAvailableSort,
} from '@modules/trip-form/constants/trip-form.constant';

@ApiTags(TRIP_FORM_TAG_SHARED)
@Controller({ version: '1', path: '/trips' })
export class TripFormSharedController {
    constructor(private readonly tripFormService: TripFormService) {}

    @TripFormSharedCreateFromTemplateDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.createFromTemplate')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/forms/from-template')
    async createFromTemplate(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Body() body: TripFormCreateFromTemplateRequestDto
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        return this.tripFormService.createFromTemplate(body, tripId, userId);
    }

    @TripFormSharedCreateDraftDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.createDraft')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/forms')
    async createDraft(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Body() body: TripFormCreateDraftRequestDto
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        return this.tripFormService.createDraft(body, tripId, userId);
    }

    @TripFormSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip-form.list')
    @Get('/:idTrip/forms')
    async list(
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @PaginationOffsetQuery({
            availableSearch: TripFormDefaultAvailableSearch,
            availableOrderBy: TripFormDefaultAvailableSort,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormSelect,
            Prisma.TripFormWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumTripFormStatus>(
            'status',
            TripFormAvailableStatus
        )
        status?: Record<string, IPaginationIn>,
        @PaginationQueryFilterInEnum<EnumTripFormKind>('kind', TripFormAvailableKind)
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseDto>> {
        return this.tripFormService.getFormList(pagination, tripId, status, kind);
    }

    @TripFormSharedGetDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.get')
    @Get('/:idTrip/forms/:idForm')
    async get(
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<TripFormResponseDto>> {
        return this.tripFormService.getForm(tripId, idForm);
    }

    @TripFormSharedUpdateDraftDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.update')
    @Patch('/:idTrip/forms/:idForm')
    async updateDraft(
        @AuthJwtPayload('userId') updatedBy: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Body() body: TripFormUpdateDraftRequestDto
    ): Promise<IResponseReturn<TripFormResponseDto>> {
        return this.tripFormService.updateDraft(tripId, idForm, body, updatedBy);
    }

    @TripFormSharedPublishDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.publish')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/forms/:idForm/publish')
    async publish(
        @AuthJwtPayload('userId') _userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<TripFormCreateDraftResponseDto>> {
        return this.tripFormService.publishForm(tripId, idForm);
    }

    @TripFormSharedCreateAssignmentDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormAssign)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.assignment.create')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/forms/:idForm/assignments')
    async createAssignment(
        @AuthJwtPayload('userId') _userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Body() body: TripFormAssignmentCreateRequestDto
    ): Promise<IResponseReturn<TripFormAssignmentResponseDto>> {
        return this.tripFormService.createAssignment(tripId, idForm, body);
    }

    @TripFormSharedArchiveDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormArchive)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.archive')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/forms/:idForm/archive')
    async archive(
        @AuthJwtPayload('userId') updatedBy: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<void>> {
        return this.tripFormService.archiveForm(tripId, idForm, updatedBy);
    }

    @TripFormSharedDeleteDoc()
    @ActivityLog(EnumActivityLogAction.adminTripFormDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.delete')
    @HttpCode(HttpStatus.OK)
    @Delete('/:idTrip/forms/:idForm')
    async delete(
        @AuthJwtPayload('userId') deletedBy: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<void>> {
        return this.tripFormService.deleteForm(tripId, idForm, deletedBy);
    }

    @TripFormSharedMetricsDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.metrics')
    @Get('/:idTrip/forms/:idForm/metrics')
    async metrics(
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<TripFormMetricsResponseDto>> {
        return this.tripFormService.getFormMetrics(tripId, idForm);
    }

    @TripFormSharedResponsesDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip-form.response.list')
    @Get('/:idTrip/forms/:idForm/responses')
    async listResponses(
        @Param('idTrip', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>> {
        return this.tripFormService.getFormResponses(tripId, idForm, pagination);
    }

}
