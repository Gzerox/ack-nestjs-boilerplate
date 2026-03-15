import {
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { SurveyTemplateCreateRequestDto } from '@modules/survey/dtos/request/survey-template.create.request.dto';
import { SurveyTemplateUpdateRequestDto } from '@modules/survey/dtos/request/survey-template.update.request.dto';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyRecipientSubmitRequestDto, SurveyRecipientUpdateRequestDto } from '@modules/survey/dtos/request/survey-recipient.update.request.dto';
import { SurveyTemplateResponseDto } from '@modules/survey/dtos/response/survey-template.response.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { ISurveyCreateData, ISurveyWithRecipientData } from '@modules/survey/interfaces/survey.interface';

export interface ISurveyService {
    // Templates (admin)
    createTemplate(
        dto: SurveyTemplateCreateRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>>;
    getTemplateListByAdmin(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyTemplateSelect,
            Prisma.SurveyTemplateWhereInput
        >,
    ): Promise<IResponsePagingReturn<SurveyTemplateResponseDto>>;
    getTemplateByAdmin(templateId: string): Promise<IResponseReturn<SurveyTemplateResponseDto>>;
    updateTemplate(
        templateId: string,
        dto: SurveyTemplateUpdateRequestDto,
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>>;
    deactivateTemplate(templateId: string): Promise<void>;

    // Surveys (admin)
    createSurvey(
        dto: SurveyCreateRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<ISurveyCreateData>>;
    getSurveyListByAdmin(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >,
    ): Promise<IResponsePagingReturn<SurveyResponseDto>>;
    getSurveyByAdmin(surveyId: string): Promise<IResponseReturn<SurveyResponseDto>>;
    closeSurvey(surveyId: string): Promise<IResponseReturn<SurveyResponseDto>>;

    // Recipients (admin)
    getRecipientListByAdmin(
        surveyId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>>;
    getRecipientByAdmin(
        surveyId: string,
        recipientId: string,
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>>;

    // User-facing
    getMySurveyList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>>;
    getMySurvey(
        surveyId: string,
        userId: string,
    ): Promise<IResponseReturn<ISurveyWithRecipientData>>;
    updatePartial(
        surveyId: string,
        userId: string,
        dto: SurveyRecipientUpdateRequestDto,
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>>;
    submitSurvey(
        surveyId: string,
        userId: string,
        dto: SurveyRecipientSubmitRequestDto,
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>>;
}
