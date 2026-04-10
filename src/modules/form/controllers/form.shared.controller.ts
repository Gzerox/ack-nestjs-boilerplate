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
    FormAvailableKind,
    FormAvailableStatus,
    FormDefaultAvailableSearch,
    FormDefaultAvailableSort,
} from '@modules/form/constants/form.constant';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';

@ApiTags(FORM_TAG_SHARED)
@Controller({ version: '1', path: '/forms' })
export class FormSharedController {
    constructor(private readonly formService: FormService) {}

    @FormSharedCreateDraftDoc()
    @ActivityLog(EnumActivityLogAction.adminFormCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.createDraft')
    @HttpCode(HttpStatus.CREATED)
    @Post('/')
    async createDraft(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: FormCreateDraftRequestDto
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        return this.formService.createDraft(body, userId);
    }

    @FormSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @ResponsePaging('form.list')
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
            FormAvailableStatus
        )
        status?: Record<string, IPaginationIn>,
        @PaginationQueryFilterInEnum<EnumFormKind>('kind', FormAvailableKind)
        kind?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<FormResponseDto>> {
        return this.formService.getFormList(pagination, status, kind, userId);
    }

    @FormSharedGetDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.get')
    @Get('/:idForm')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<FormResponseDto>> {
        return this.formService.getForm(idForm, userId);
    }

    @FormSharedUpdateDraftDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.update')
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
    @ActivityLog(EnumActivityLogAction.adminFormPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.publish')
    @HttpCode(HttpStatus.OK)
    @Post('/:idForm/publish')
    async publish(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<FormCreateDraftResponseDto>> {
        return this.formService.publishForm(idForm, userId);
    }

    @FormSharedCreateAssignmentDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.assignment.create')
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
    @ActivityLog(EnumActivityLogAction.adminFormArchive)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.archive')
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
    @ActivityLog(EnumActivityLogAction.adminFormDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.delete')
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
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.metrics')
    @Get('/:idForm/metrics')
    async metrics(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string
    ): Promise<IResponseReturn<FormMetricsResponseDto>> {
        return this.formService.getFormMetrics(idForm);
    }

    @FormSharedResponsesDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @ResponsePaging('form.response.list')
    @Get('/:idForm/responses')
    async listResponses(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>> {
        return this.formService.getFormResponses(idForm, pagination);
    }

    @FormSharedQuestionSummaryDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('form')
    @ApiKeyProtected()
    @Response('form.question.summary')
    @Get('/:idForm/questions/:questionId/summary')
    async questionSummary(
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Param('questionId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        questionId: string
    ): Promise<IResponseReturn<FormQuestionSummaryResponseDto>> {
        return this.formService.getQuestionSummary(idForm, questionId);
    }
}
