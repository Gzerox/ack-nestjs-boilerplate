import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import { SurveyService } from '@modules/survey/services/survey.service';
import { PolicyAbilityProtected } from '@modules/policy/decorators/policy.decorator';
import {
    EnumPolicyAction,
    EnumPolicySubject,
} from '@modules/policy/enums/policy.enum';
import { RoleProtected } from '@modules/role/decorators/role.decorator';
import { EnumActivityLogAction, EnumRoleType, Prisma } from '@generated/prisma-client';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import {
    PaginationOffsetQuery,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import { SurveyTemplateResponseDto } from '@modules/survey/dtos/response/survey-template.response.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyTemplateCreateRequestDto } from '@modules/survey/dtos/request/survey-template.create.request.dto';
import { SurveyTemplateUpdateRequestDto } from '@modules/survey/dtos/request/survey-template.update.request.dto';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SURVEY_TAG } from '@modules/survey/constants/survey.doc.constant';
import { ISurveyCreateData } from '@modules/survey/interfaces/survey.interface';

@ApiTags(SURVEY_TAG)
@Controller({
    version: '1',
    path: '/survey',
})
export class SurveyAdminController {
    constructor(private readonly surveyService: SurveyService) {}

    // Survey Template endpoints
    @Response('survey.template.create')
    @ActivityLog(EnumActivityLogAction.adminSurveyTemplateCreate)
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyTemplate,
        action: [EnumPolicyAction.create],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Post('/template')
    async createTemplate(
        @Body() dto: SurveyTemplateCreateRequestDto,
        @AuthJwtPayload() { sub }: Record<string, any>
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        return this.surveyService.createTemplate(dto, sub);
    }

    @ResponsePaging('survey.template.list')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyTemplate,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/template')
    async listTemplate(
        @PaginationOffsetQuery({})
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyTemplateSelect,
            Prisma.SurveyTemplateWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyTemplateResponseDto>> {
        return this.surveyService.getTemplateListByAdmin(pagination);
    }

    @Response('survey.template.get')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyTemplate,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/template/:templateId')
    async getTemplate(
        @Param('templateId', RequestRequiredPipe)
        templateId: string
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        return this.surveyService.getTemplateByAdmin(templateId);
    }

    @Response('survey.template.update')
    @ActivityLog(EnumActivityLogAction.adminSurveyTemplateUpdate)
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyTemplate,
        action: [EnumPolicyAction.update],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Patch('/template/:templateId')
    async updateTemplate(
        @Param('templateId', RequestRequiredPipe)
        templateId: string,
        @Body() dto: SurveyTemplateUpdateRequestDto
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        return this.surveyService.updateTemplate(templateId, dto);
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @ActivityLog(EnumActivityLogAction.adminSurveyTemplateDeactivate)
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyTemplate,
        action: [EnumPolicyAction.delete],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Delete('/template/:templateId')
    async deactivateTemplate(
        @Param('templateId', RequestRequiredPipe)
        templateId: string
    ): Promise<void> {
        return this.surveyService.deactivateTemplate(templateId);
    }

    // Survey endpoints
    @Response('survey.create')
    @ActivityLog(EnumActivityLogAction.adminSurveyCreate)
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.survey,
        action: [EnumPolicyAction.create],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Post('/')
    async createSurvey(
        @Body() dto: SurveyCreateRequestDto,
        @AuthJwtPayload() { sub }: Record<string, any>
    ): Promise<IResponseReturn<ISurveyCreateData>> {
        return this.surveyService.createSurvey(dto, sub);
    }

    @ResponsePaging('survey.list')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.survey,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/')
    async listSurvey(
        @PaginationOffsetQuery({})
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyResponseDto>> {
        return this.surveyService.getSurveyListByAdmin(pagination);
    }

    @Response('survey.get')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.survey,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId')
    async getSurvey(
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string
    ): Promise<IResponseReturn<SurveyResponseDto>> {
        return this.surveyService.getSurveyByAdmin(surveyId);
    }

    @Response('survey.close')
    @ActivityLog(EnumActivityLogAction.adminSurveyClosed)
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.survey,
        action: [EnumPolicyAction.update],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Patch('/:surveyId/close')
    async closeSurvey(
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string
    ): Promise<IResponseReturn<SurveyResponseDto>> {
        return this.surveyService.closeSurvey(surveyId);
    }

    // Survey Recipient endpoints
    @ResponsePaging('survey.recipient.list')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyRecipient,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId/recipient')
    async listRecipient(
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string,
        @PaginationOffsetQuery({})
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getRecipientListByAdmin(surveyId, pagination);
    }

    @Response('survey.recipient.get')
    @PolicyAbilityProtected({
        subject: EnumPolicySubject.surveyRecipient,
        action: [EnumPolicyAction.read],
    })
    @RoleProtected(EnumRoleType.admin)
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId/recipient/:recipientId')
    async getRecipient(
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string,
        @Param('recipientId', RequestRequiredPipe)
        recipientId: string
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getRecipientByAdmin(surveyId, recipientId);
    }
}
