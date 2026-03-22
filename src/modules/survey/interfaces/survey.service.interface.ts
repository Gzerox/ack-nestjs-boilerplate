import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyUpdateRequestDto } from '@modules/survey/dtos/request/survey.update.request.dto';
import { SurveyUserPatchRequestDto, SurveyUserSubmitRequestDto } from '@modules/survey/dtos/request/survey-recipient.update.request.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyWithRecipientResponseDto } from '@modules/survey/dtos/response/survey-with-recipient.response.dto';
import { SurveyPublishResponseDto } from '@modules/survey/dtos/response/survey-publish.response.dto';

export interface ISurveyService {
    // Shared (manager)
    publish(
        dto: SurveyCreateRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<SurveyPublishResponseDto>>;
    getSurveyList(
        pagination: IPaginationQueryOffsetParams<Prisma.SurveySelect, Prisma.SurveyWhereInput>,
        status?: Record<string, IPaginationIn>,
        createdBy?: string,
    ): Promise<IResponsePagingReturn<SurveyResponseDto>>;
    getSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<SurveyResponseDto>>;
    updateSurvey(surveyId: string, dto: SurveyUpdateRequestDto, createdBy?: string): Promise<IResponseReturn<SurveyResponseDto>>;
    archiveSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<void>>;
    deleteSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<void>>;
    getRecipientList(
        surveyId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        createdBy?: string,
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>>;
    getRecipient(surveyId: string, recipientId: string, createdBy?: string): Promise<IResponseReturn<SurveyRecipientResponseDto>>;

    // User-facing
    getMySurveyList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        status?: Record<string, IPaginationIn>,
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>>;
    getMySurvey(surveyId: string, userId: string): Promise<IResponseReturn<SurveyWithRecipientResponseDto>>;
    submit(surveyId: string, dto: SurveyUserSubmitRequestDto, userId: string): Promise<IResponseReturn<SurveyRecipientResponseDto>>;
}
