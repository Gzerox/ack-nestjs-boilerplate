import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { AuthJwtAccessProtected, AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { TermPolicyAcceptanceProtected } from '@modules/term-policy/decorators/term-policy.decorator';
import { PaginationOffsetQuery, PaginationQueryFilterInEnum } from '@common/pagination/decorators/pagination.decorator';
import { IPaginationIn, IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { EnumSurveyRecipientStatus, Prisma } from '@generated/prisma-client';
import { SurveyService } from '@modules/survey/services/survey.service';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyWithRecipientResponseDto } from '@modules/survey/dtos/response/survey-with-recipient.response.dto';
import { SurveyUserSubmitRequestDto } from '@modules/survey/dtos/request/survey-recipient.update.request.dto';
import {
    SurveyUserGetDoc,
    SurveyUserListDoc,
    SurveyUserSubmitDoc,
} from '@modules/survey/docs/survey.user.doc';
import { SURVEY_TAG_USER, SurveyDefaultRecipientStatus } from '@modules/survey/constants/survey.list.constant';

@ApiTags(SURVEY_TAG_USER)
@Controller({
    version: '1',
    path: '/surveys',
})
export class SurveyUserController {
    constructor(private readonly surveyService: SurveyService) {}

    @SurveyUserListDoc()
    @ResponsePaging('survey.list')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumSurveyRecipientStatus>(
            'status',
            SurveyDefaultRecipientStatus
        )
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.getMySurveyList(userId, pagination, status);
    }

    @SurveyUserGetDoc()
    @Response('survey.get')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:surveyId')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string
    ): Promise<IResponseReturn<SurveyWithRecipientResponseDto>> {
        return this.surveyService.getMySurvey(surveyId, userId);
    }

    @SurveyUserSubmitDoc()
    @Response('survey.submit')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Post('/:surveyId/submit')
    async submit(
        @AuthJwtPayload('userId') userId: string,
        @Param('surveyId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        surveyId: string,
        @Body() dto: SurveyUserSubmitRequestDto
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        return this.surveyService.submit(surveyId, dto, userId);
    }
}
