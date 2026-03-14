import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import { SurveyService } from '@modules/survey/services/survey.service';
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
import { Prisma } from '@generated/prisma-client';
import { SurveyRecipientResponseDto } from '../dtos/response/survey-recipient.response.dto';
import { SurveyRecipientSubmitRequestDto, SurveyRecipientUpdateRequestDto } from '../dtos/request/survey-recipient.update.request.dto';
import { SURVEY_TAG } from '../constants/survey.doc.constant';

@ApiTags(SURVEY_TAG)
@Controller({
    version: '1',
    path: '/survey',
})
export class SurveyUserController {
    constructor(private readonly surveyService: SurveyService) {}

    @ResponsePaging('survey.list')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/')
    async listMySurveys(
        @AuthJwtPayload() { sub }: Record<string, any>,
        @PaginationOffsetQuery({})
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getMySurveyList(sub, pagination);
    }

    @Response('survey.get')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId')
    async getMySurvey(
        @AuthJwtPayload() { sub }: Record<string, any>,
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string
    ): Promise<IResponseReturn<any>> {
        return this.surveyService.getMySurvey(surveyId, sub);
    }

    @Response('survey.save')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Patch('/:surveyId')
    async saveSurvey(
        @AuthJwtPayload() { sub }: Record<string, any>,
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string,
        @Body() dto: SurveyRecipientUpdateRequestDto
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.updatePartial(surveyId, sub, dto);
    }

    @Response('survey.submit')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Post('/:surveyId/submit')
    async submitSurvey(
        @AuthJwtPayload() { sub }: Record<string, any>,
        @Param('surveyId', RequestRequiredPipe)
        surveyId: string,
        @Body() dto: SurveyRecipientSubmitRequestDto
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.submitSurvey(surveyId, sub, dto);
    }
}
