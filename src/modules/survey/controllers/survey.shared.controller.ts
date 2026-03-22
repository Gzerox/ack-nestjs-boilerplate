import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { AuthJwtAccessProtected } from '@modules/auth/decorators/auth.jwt.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { RoleProtected } from '@modules/role/decorators/role.decorator';
import {
    EnumActivityLogAction,
    EnumRoleType,
    EnumSurveyStatus,
    Prisma,
} from '@generated/prisma-client';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import { PaginationOffsetQuery, PaginationQueryFilterInEnum } from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { SurveyService } from '@modules/survey/services/survey.service';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyUpdateRequestDto } from '@modules/survey/dtos/request/survey.update.request.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyPublishResponseDto } from '@modules/survey/dtos/response/survey-publish.response.dto';
import {
    SurveySharedArchiveDoc,
    SurveySharedDeleteDoc,
    SurveySharedGetDoc,
    SurveySharedListDoc,
    SurveySharedPublishDoc,
    SurveySharedRecipientGetDoc,
    SurveySharedRecipientListDoc,
    SurveySharedUpdateDoc,
} from '@modules/survey/docs/survey.shared.doc';
import {
    SURVEY_TAG_SHARED,
    SurveyDefaultAvailableSearch,
    SurveyDefaultAvailableSort,
    SurveyDefaultStatus,
} from '@modules/survey/constants/survey.list.constant';

@ApiTags(SURVEY_TAG_SHARED)
@Controller({
    version: '1',
    path: '/surveys',
})
export class SurveySharedController {
    constructor(private readonly surveyService: SurveyService) {}

    @SurveySharedPublishDoc()
    @Response('survey.publish')
    @RoleProtected(EnumRoleType.admin)
    @ActivityLog(EnumActivityLogAction.adminSurveyPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.CREATED)
    @Post('/')
    async publish(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: SurveyCreateRequestDto
    ): Promise<IResponseReturn<SurveyPublishResponseDto>> {
        return this.surveyService.publish(body, userId);
    }

    @SurveySharedListDoc()
    @ResponsePaging('survey.list')
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @PaginationOffsetQuery({
            availableSearch: SurveyDefaultAvailableSearch,
            availableOrderBy: SurveyDefaultAvailableSort,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumSurveyStatus>(
            'status',
            SurveyDefaultStatus
        )
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<SurveyResponseDto>> {
        return this.surveyService.getSurveyList(pagination, status, userId);
    }

    @SurveySharedGetDoc()
    @Response('survey.get')
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string
    ): Promise<IResponseReturn<SurveyResponseDto>> {
        return this.surveyService.getSurvey(surveyId, userId);
    }

    @SurveySharedUpdateDoc()
    @Response('survey.update')
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Put('/:surveyId')
    async update(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string,
        @Body() body: SurveyUpdateRequestDto
    ): Promise<IResponseReturn<SurveyResponseDto>> {
        return this.surveyService.updateSurvey(surveyId, body, userId);
    }

    @SurveySharedArchiveDoc()
    @Response('survey.archive')
    @RoleProtected(EnumRoleType.admin)
    @ActivityLog(EnumActivityLogAction.adminSurveyArchive)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Post('/:surveyId/archive')
    async archive(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string
    ): Promise<IResponseReturn<void>> {
        return this.surveyService.archiveSurvey(surveyId, userId);
    }

    @SurveySharedDeleteDoc()
    @Response('survey.delete')
    @RoleProtected(EnumRoleType.admin)
    @ActivityLog(EnumActivityLogAction.adminSurveyDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Delete('/:surveyId')
    async delete(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string
    ): Promise<IResponseReturn<void>> {
        return this.surveyService.deleteSurvey(surveyId, userId);
    }

    @SurveySharedRecipientListDoc()
    @ResponsePaging('survey.recipient.list')
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId/recipients')
    async listRecipients(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getRecipientList(
            surveyId,
            pagination,
            userId
        );
    }

    @SurveySharedRecipientGetDoc()
    @Response('survey.recipient.get')
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId/recipients/:recipientId')
    async getRecipient(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string,
        @Param('recipientId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        recipientId: string
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getRecipient(surveyId, recipientId, userId);
    }
}
