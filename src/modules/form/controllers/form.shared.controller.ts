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
import {
    RequestGeoLocation,
    RequestIPAddress,
    RequestUserAgent,
} from '@common/request/decorators/request.decorator';
import { GeoLocation, UserAgent } from '@generated/prisma-client';
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
    EnumFormKind,
    EnumFormStatus,
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
import { FormService } from '@modules/form/services/form.service';
import { FormCreateDraftRequestDto } from '@modules/form/dtos/request/form-create-draft.request.dto';
import { FormUpdateDraftRequestDto } from '@modules/form/dtos/request/form-update-draft.request.dto';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormCreateDraftResponseDto } from '@modules/form/dtos/response/form-create-draft.response.dto';
import { FormAssignmentResponseDto } from '@modules/form/dtos/response/form-assignment.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormMetricsResponseDto } from '@modules/form/dtos/response/form-metrics.response.dto';
import { FormQuestionSummaryResponseDto } from '@modules/form/dtos/response/form-question-summary.response.dto';
import {
    FormSharedArchiveDoc,
    FormSharedCreateAssignmentDoc,
    FormSharedCreateDraftDoc,
    FormSharedDeleteDoc,
    FormSharedGetDoc,
    FormSharedListDoc,
    FormSharedMetricsDoc,
    FormSharedPublishDoc,
    FormSharedQuestionSummaryDoc,
    FormSharedResponsesDoc,
    FormSharedUpdateDraftDoc,
} from '@modules/form/docs/form.shared.doc';
import {
    FORM_TAG_SHARED,
    FormDefaultAvailableSearch,
    FormDefaultAvailableSort,
    FormDefaultStatus,
} from '@modules/form/constants/form.constant';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';

@ApiTags(FORM_TAG_SHARED)
@Controller({ version: '1', path: '/forms' })
export class FormSharedController {
    constructor(private readonly formService: FormService) {}

    @FormSharedCreateDraftDoc()
    @Response('form.createDraft')
    @ActivityLog(EnumActivityLogAction.adminFormCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @HttpCode(HttpStatus.CREATED)
    @Post('/')
    async createDraft(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: FormCreateDraftRequestDto
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        return this.formService.createDraft(body, userId);
    }

    @FormSharedListDoc()
    @ResponsePaging('form.list')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Get('/')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @PaginationOffsetQuery({
            availableSearch: FormDefaultAvailableSearch,
            availableOrderBy: FormDefaultAvailableSort,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormSelect,
            Prisma.FormWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumFormStatus>(
            'status',
            FormDefaultStatus
        )
        status?: Record<string, IPaginationIn>,
        @PaginationQueryFilterInEnum<EnumFormKind>(
            'kind',
            Object.values(EnumFormKind)
        )
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<FormResponseDto>> {
        return this.formService.getFormList(pagination, status, kind, userId);
    }

    @FormSharedGetDoc()
    @Response('form.get')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Get('/:idForm')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<FormResponseDto>> {
        return this.formService.getForm(idForm, userId);
    }

    @FormSharedUpdateDraftDoc()
    @Response('form.update')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Patch('/:idForm')
    async updateDraft(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Body() body: FormUpdateDraftRequestDto
    ): Promise<IResponseReturn<FormResponseDto>> {
        return this.formService.updateDraft(idForm, body, userId);
    }

    @FormSharedPublishDoc()
    @Response('form.publish')
    @ActivityLog(EnumActivityLogAction.adminFormPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Post('/:idForm/publish')
    async publish(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @RequestIPAddress() ipAddress: string,
        @RequestUserAgent() userAgent: UserAgent,
        @RequestGeoLocation() geoLocation: GeoLocation | null
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        return this.formService.publishForm(idForm, userId, {
            ipAddress,
            userAgent,
            geoLocation
        });
    }

    @FormSharedCreateAssignmentDoc()
    @Response('form.assignment.create')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idForm/assignments')
    async createAssignment(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Body() body: FormAssignmentCreateRequestDto
    ): Promise<IResponseReturn<FormAssignmentResponseDto>> {
        return this.formService.createAssignment(idForm, body, userId);
    }

    @FormSharedArchiveDoc()
    @Response('form.archive')
    @ActivityLog(EnumActivityLogAction.adminFormArchive)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Post('/:idForm/archive')
    async archive(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<void>> {
        return this.formService.archiveForm(idForm, userId);
    }

    @FormSharedDeleteDoc()
    @Response('form.delete')
    @ActivityLog(EnumActivityLogAction.adminFormDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Delete('/:idForm')
    async delete(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<void>> {
        return this.formService.deleteForm(idForm, userId);
    }

    @FormSharedMetricsDoc()
    @Response('form.metrics')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Get('/:idForm/metrics')
    async metrics(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<FormMetricsResponseDto>> {
        return this.formService.getFormMetrics(idForm);
    }

    @FormSharedResponsesDoc()
    @ResponsePaging('form.response.list')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Get('/:idForm/responses')
    async listResponses(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>> {
        return this.formService.getFormResponses(idForm, pagination);
    }

    @FormSharedQuestionSummaryDoc()
    @Response('form.question.summary')
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Get('/:idForm/questions/:questionId/summary')
    async questionSummary(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Param('questionId', RequestRequiredPipe) questionId: string
    ): Promise<IResponseReturn<FormQuestionSummaryResponseDto>> {
        return this.formService.getQuestionSummary(idForm, questionId);
    }
}
