import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ISurveyService } from '@modules/survey/interfaces/survey.service.interface';
import { SurveyWithRecipientResponseDto } from '@modules/survey/dtos/response/survey-with-recipient.response.dto';
import { SurveyRepository } from '@modules/survey/repositories/survey.repository';
import { SurveyRecipientRepository } from '@modules/survey/repositories/survey-recipient.repository';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyUpdateRequestDto } from '@modules/survey/dtos/request/survey.update.request.dto';
import { SurveyUserSubmitRequestDto } from '@modules/survey/dtos/request/survey-recipient.update.request.dto';
import { EnumSurveyStatusCodeError } from '@modules/survey/enums/survey.status-code.enum';
import { $Enums, EnumSurveyStatus, Prisma } from '@generated/prisma-client';
import { SurveyUtil } from '@modules/survey/utils/survey.util';
import { HelperService } from '@common/helper/services/helper.service';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyPublishResponseDto } from '@modules/survey/dtos/response/survey-publish.response.dto';
import EnumSurveyRecipientStatus = $Enums.EnumSurveyRecipientStatus;

@Injectable()
export class SurveyService implements ISurveyService {
    private readonly logger = new Logger(SurveyService.name);

    constructor(
        private readonly surveyRepository: SurveyRepository,
        private readonly surveyRecipientRepository: SurveyRecipientRepository,
        private readonly surveyUtil: SurveyUtil,
        private readonly helperService: HelperService
    ) {}

    // Shared (manager) — publish creates survey directly as published
    async publish(
        dto: SurveyCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<SurveyPublishResponseDto>> {
        const surveyData: Prisma.SurveyCreateInput = {
            createdBy,
            title: dto.title,
            description: dto.description || null,
            schemaSnapshot: {
                title: dto.title,
                description: dto.description || null,
                sections: dto.sections,
            } as any,
            closesAt: dto.closesAt,
            status: EnumSurveyStatus.published,
            publishedAt: this.helperService.dateCreate(),
        };

        const sections = dto.sections.map((s, i) => ({
            sectionId: s.name,
            label: s.label,
            position: i,
        }));

        const questions = dto.sections.flatMap((s, _si) =>
            s.questions.map((q, qi) => ({
                sectionId: s.name,
                questionId: q.name,
                type: q.type,
                label: q.label,
                required: q.required,
                position: qi,
                validation: q.validation ? (q.validation as any) : null,
                options: q.options?.length ? (q.options as any) : null,
            }))
        );

        const recipients = dto.recipients.map((r) => ({
            userId: r.userId,
            status: EnumSurveyRecipientStatus.notStarted,
        })) as Omit<Prisma.SurveyRecipientCreateManyInput, 'surveyId'>[];

        const survey = await this.surveyRepository.createWithRecipients(surveyData, sections, questions, recipients);

        return { data: { id: survey.id } };
    }

    async getSurveyList(
        pagination: IPaginationQueryOffsetParams<Prisma.SurveySelect, Prisma.SurveyWhereInput>,
        status?: Record<string, IPaginationIn>,
        createdBy?: string
    ): Promise<IResponsePagingReturn<SurveyResponseDto>> {
        const result = await this.surveyRepository.findMany(pagination, status, createdBy);
        return {
            ...result,
            data: this.surveyUtil.mapSurveyList(result.data as any),
        } as IResponsePagingReturn<SurveyResponseDto>;
    }

    async getSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<SurveyResponseDto>> {
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }
        return { data: this.surveyUtil.mapSurveyOne(survey) };
    }

    async updateSurvey(surveyId: string, dto: SurveyUpdateRequestDto, createdBy?: string): Promise<IResponseReturn<SurveyResponseDto>> {
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        if (survey.status !== EnumSurveyStatus.draft) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.surveyNotDraft,
                message: 'survey.error.surveyNotDraft',
            });
        }

        const needsSnapshotRebuild = dto.title !== undefined || dto.description !== undefined || dto.sections !== undefined;
        const snapshot = survey.schemaSnapshot as any;

        const updated = await this.surveyRepository.update(surveyId, {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && { description: dto.description || null }),
            ...(dto.closesAt !== undefined && { closesAt: dto.closesAt }),
            ...(needsSnapshotRebuild && {
                schemaSnapshot: {
                    title: dto.title ?? survey.title,
                    description: dto.description !== undefined ? (dto.description || null) : snapshot.description,
                    sections: dto.sections ?? snapshot.sections,
                } as any,
            }),
        });

        return { data: this.surveyUtil.mapSurveyOne(updated) };
    }

    async archiveSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<void>> {
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        if (survey.status !== EnumSurveyStatus.published) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.surveyNotPublished,
                message: 'survey.error.surveyNotPublished',
            });
        }

        await this.surveyRepository.archive(surveyId);
        return { data: null };
    }

    async deleteSurvey(surveyId: string, createdBy?: string): Promise<IResponseReturn<void>> {
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        await this.surveyRepository.delete(surveyId);
        return { data: null };
    }

    async getRecipientList(
        surveyId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        createdBy?: string
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        // Verify survey exists and belongs to caller
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        const result = await this.surveyRecipientRepository.findManyBySurvey(surveyId, pagination);
        return {
            ...result,
            data: this.surveyUtil.mapRecipientList(result.data as any),
        } as IResponsePagingReturn<SurveyRecipientResponseDto>;
    }

    async getRecipient(surveyId: string, recipientId: string, createdBy?: string): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        const survey = await this.surveyRepository.findById(surveyId, createdBy);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        const recipient = await this.surveyRecipientRepository.findByIdAndSurvey(recipientId, surveyId);
        if (!recipient) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.recipientNotFound,
                message: 'survey.error.recipientNotFound',
            });
        }
        return { data: this.surveyUtil.mapRecipientOne(recipient) };
    }

    // User-facing
    async getMySurveyList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        const result = await this.surveyRecipientRepository.findManyByUser(userId, pagination, status);
        return {
            ...result,
            data: this.surveyUtil.mapRecipientList(result.data as any),
        } as IResponsePagingReturn<SurveyRecipientResponseDto>;
    }

    async getMySurvey(surveyId: string, userId: string): Promise<IResponseReturn<SurveyWithRecipientResponseDto>> {
        const { survey, recipient } = await this.findSurveyAndRecipient(surveyId, userId);

        return {
            data: {
                survey: this.surveyUtil.mapSurveyUser(survey),
                recipient: this.surveyUtil.mapRecipientOne(recipient),
            },
        };
    }

    async submit(surveyId: string, dto: SurveyUserSubmitRequestDto, userId: string): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        const { survey, recipient } = await this.findSurveyAndRecipient(surveyId, userId);

        // Guard: survey must be published
        if (survey.status !== EnumSurveyStatus.published) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.surveyNotPublished,
                message: 'survey.error.surveyNotPublished',
            });
        }

        // Guard: survey must not be closed
        if (survey.closesAt && this.helperService.dateCreate() > survey.closesAt) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.surveyClosed,
                message: 'survey.error.surveyClosed',
            });
        }

        // Guard: already submitted
        if (recipient.status === EnumSurveyRecipientStatus.submitted) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.recipientAlreadySubmitted,
                message: 'survey.error.recipientAlreadySubmitted',
            });
        }

        const finalAnswers = dto.answers ? dto.answers : [];

        // Update with submission
        const submitted = await this.surveyRecipientRepository.upsertAnswers(
            recipient.id,
            survey.id,
            finalAnswers as any,
            EnumSurveyRecipientStatus.submitted,
            this.helperService.dateCreate()
        );

        return { data: this.surveyUtil.mapRecipientOne(submitted) };
    }

    private async findSurveyAndRecipient(surveyId: string, userId: string) {
        //TODO: Why performing 2 search query ? can't we just use surveyRecipientRepository.findBySurveyAndUser and determine from that
        const survey = await this.surveyRepository.findById(surveyId);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        const recipient =
            await this.surveyRecipientRepository.findBySurveyAndUser(
                surveyId,
                userId
            );
        if (!recipient) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.recipientNotFound,
                message: 'survey.error.recipientNotFound',
            });
        }

        return { survey, recipient };
    }
}
