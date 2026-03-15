import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ISurveyService } from '@modules/survey/interfaces/survey.service.interface';
import { ISurveyCreateData, ISurveyWithRecipientData } from '@modules/survey/interfaces/survey.interface';
import { SurveyTemplateRepository } from '@modules/survey/repositories/survey-template.repository';
import { SurveyRepository } from '@modules/survey/repositories/survey.repository';
import { SurveyRecipientRepository } from '@modules/survey/repositories/survey-recipient.repository';
import { SurveyTemplateCreateRequestDto } from '@modules/survey/dtos/request/survey-template.create.request.dto';
import { SurveyTemplateUpdateRequestDto } from '@modules/survey/dtos/request/survey-template.update.request.dto';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyRecipientSubmitRequestDto, SurveyRecipientUpdateRequestDto } from '@modules/survey/dtos/request/survey-recipient.update.request.dto';
import { EnumSurveyStatusCodeError } from '@modules/survey/enums/survey.status-code.enum';
import { Prisma, Survey, SurveyRecipient, SurveyRecipientStatus } from '@generated/prisma-client';
import { SurveyUtil } from '@modules/survey/utils/survey.util';
import { SurveyTemplateResponseDto } from '@modules/survey/dtos/response/survey-template.response.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

type SurveyWithRecipient = { survey: Survey; recipient: SurveyRecipient };

@Injectable()
export class SurveyService implements ISurveyService {
    private readonly logger = new Logger(SurveyService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly surveyTemplateRepository: SurveyTemplateRepository,
        private readonly surveyRepository: SurveyRepository,
        private readonly surveyRecipientRepository: SurveyRecipientRepository,
        private readonly surveyUtil: SurveyUtil
    ) {}

    // Templates (admin)
    async createTemplate(
        dto: SurveyTemplateCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        const exists = await this.surveyTemplateRepository.existByCreatedByAndName(
            createdBy,
            dto.name
        );
        if (exists) {
            throw new ConflictException({
                statusCode: EnumSurveyStatusCodeError.templateNameExist,
                message: 'survey.error.templateNameExist',
            });
        }

        const template = await this.surveyTemplateRepository.create({
            createdBy,
            name: dto.name,
            schema: dto.schema as any,
        });

        return { data: this.surveyUtil.mapTemplateOne(template) };
    }

    async getTemplateListByAdmin(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyTemplateSelect,
            Prisma.SurveyTemplateWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyTemplateResponseDto>> {
        const result = await this.surveyTemplateRepository.findMany(pagination);
        return {
            ...result,
            data: this.surveyUtil.mapTemplateList(result.data as any),
        } as IResponsePagingReturn<SurveyTemplateResponseDto>;
    }

    async getTemplateByAdmin(templateId: string): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        const template = await this.surveyTemplateRepository.findById(templateId);
        if (!template) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.templateNotFound,
                message: 'survey.error.templateNotFound',
            });
        }
        return { data: this.surveyUtil.mapTemplateOne(template) };
    }

    async updateTemplate(
        templateId: string,
        dto: SurveyTemplateUpdateRequestDto
    ): Promise<IResponseReturn<SurveyTemplateResponseDto>> {
        const template = await this.surveyTemplateRepository.findById(templateId);
        if (!template) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.templateNotFound,
                message: 'survey.error.templateNotFound',
            });
        }

        const updated = await this.surveyTemplateRepository.update(templateId, {
            name: dto.name,
            schema: dto.schema as any,
        });

        return { data: this.surveyUtil.mapTemplateOne(updated) };
    }

    async deactivateTemplate(templateId: string): Promise<void> {
        const template = await this.surveyTemplateRepository.findById(templateId);
        if (!template) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.templateNotFound,
                message: 'survey.error.templateNotFound',
            });
        }

        await this.surveyTemplateRepository.deactivate(templateId);
    }

    // Surveys (admin)
    async createSurvey(
        dto: SurveyCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<ISurveyCreateData>> {
        const survey = await this.databaseService.$transaction(async (tx) => {
            const createdSurvey = await tx.survey.create({
                data: {
                    createdBy,
                    title: dto.title,
                    description: dto.description,
                    schemaSnapshot: dto.schemaSnapshot as any,
                    closesAt: dto.closesAt,
                },
                include: { _count: { select: { recipients: true } } },
            });

            // Bulk create recipients
            const recipientData = dto.recipientUserIds.map((userId) => ({
                surveyId: createdSurvey.id,
                userId,
                sourceType: dto.sourceType,
                sourceId: dto.sourceId,
                status: SurveyRecipientStatus.notStarted,
            }));

            await tx.surveyRecipient.createMany({
                data: recipientData,
            });

            return createdSurvey;
        });

        return {
            data: {
                survey: this.surveyUtil.mapSurveyOne(survey),
                recipientCount: dto.recipientUserIds.length,
            },
        };
    }

    async getSurveyListByAdmin(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyResponseDto>> {
        const result = await this.surveyRepository.findMany(pagination);
        return {
            ...result,
            data: this.surveyUtil.mapSurveyList(result.data as any),
        } as IResponsePagingReturn<SurveyResponseDto>;
    }

    async getSurveyByAdmin(surveyId: string): Promise<IResponseReturn<SurveyResponseDto>> {
        const survey = await this.surveyRepository.findById(surveyId);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }
        return { data: this.surveyUtil.mapSurveyOne(survey) };
    }

    async closeSurvey(surveyId: string): Promise<IResponseReturn<SurveyResponseDto>> {
        const survey = await this.surveyRepository.findById(surveyId);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        const closed = await this.surveyRepository.close(surveyId);
        return { data: this.surveyUtil.mapSurveyOne(closed) };
    }

    // Recipients (admin)
    async getRecipientListByAdmin(
        surveyId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyRecipientSelect,
            Prisma.SurveyRecipientWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        // Verify survey exists
        const survey = await this.surveyRepository.findById(surveyId);
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

    async getRecipientByAdmin(
        surveyId: string,
        recipientId: string
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        const recipient = await this.surveyRecipientRepository.findByIdAndSurvey(
            recipientId,
            surveyId
        );
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
        >
    ): Promise<IResponsePagingReturn<SurveyRecipientResponseDto>> {
        // Intentionally overrides any caller-supplied status filter to exclude submitted surveys
        const mergedWhere = {
            ...pagination.where,
            status: { not: SurveyRecipientStatus.submitted },
        };

        const params = { ...pagination, where: mergedWhere };
        const result = await this.surveyRecipientRepository.findManyByUser(userId, params);
        return {
            ...result,
            data: this.surveyUtil.mapRecipientList(result.data as any),
        } as IResponsePagingReturn<SurveyRecipientResponseDto>;
    }

    async getMySurvey(
        surveyId: string,
        userId: string
    ): Promise<IResponseReturn<ISurveyWithRecipientData>> {
        const { survey, recipient } = await this.findSurveyAndRecipient(surveyId, userId);
        return {
            data: {
                survey: this.surveyUtil.mapSurveyOne(survey),
                recipient: this.surveyUtil.mapRecipientOne(recipient),
            },
        };
    }

    async updatePartial(
        surveyId: string,
        userId: string,
        dto: SurveyRecipientUpdateRequestDto
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        const { survey, recipient } = await this.findSurveyAndRecipient(surveyId, userId);

        // Guard: cannot save if already submitted
        if (recipient.status === SurveyRecipientStatus.submitted) {
            throw new BadRequestException({
                statusCode: EnumSurveyStatusCodeError.recipientAlreadySubmitted,
                message: 'survey.error.recipientAlreadySubmitted',
            });
        }

        // Guard: survey must be open
        if (!survey.isActive || survey.closesAt < new Date()) {
            throw new BadRequestException({
                statusCode: EnumSurveyStatusCodeError.surveyClosed,
                message: 'survey.error.surveyClosed',
            });
        }

        const newStatus = SurveyRecipientStatus.inProgress;

        const updated = await this.surveyRecipientRepository.updateAnswers(
            recipient.id,
            dto.answers as any,
            newStatus
        );

        return { data: this.surveyUtil.mapRecipientOne(updated) };
    }

    async submitSurvey(
        surveyId: string,
        userId: string,
        dto: SurveyRecipientSubmitRequestDto
    ): Promise<IResponseReturn<SurveyRecipientResponseDto>> {
        const { survey, recipient } = await this.findSurveyAndRecipient(surveyId, userId);

        // Guard: cannot resubmit
        if (recipient.status === SurveyRecipientStatus.submitted) {
            throw new BadRequestException({
                statusCode: EnumSurveyStatusCodeError.recipientAlreadySubmitted,
                message: 'survey.error.recipientAlreadySubmitted',
            });
        }

        // Guard: survey must be open
        if (!survey.isActive || survey.closesAt < new Date()) {
            throw new BadRequestException({
                statusCode: EnumSurveyStatusCodeError.surveyClosed,
                message: 'survey.error.surveyClosed',
            });
        }

        // TODO: Validate all required questions answered against survey.schemaSnapshot
        // This is a placeholder for schema validation logic

        const updated = await this.surveyRecipientRepository.updateAnswers(
            recipient.id,
            dto.answers as any,
            SurveyRecipientStatus.submitted,
            new Date()
        );

        return { data: this.surveyUtil.mapRecipientOne(updated) };
    }

    // Private helper: fetches raw Prisma entities to avoid consuming response-envelope methods internally
    private async findSurveyAndRecipient(
        surveyId: string,
        userId: string
    ): Promise<SurveyWithRecipient> {
        const survey = await this.surveyRepository.findById(surveyId);
        if (!survey) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.surveyNotFound,
                message: 'survey.error.surveyNotFound',
            });
        }

        const recipient = await this.surveyRecipientRepository.findBySurveyAndUser(surveyId, userId);
        if (!recipient) {
            throw new NotFoundException({
                statusCode: EnumSurveyStatusCodeError.recipientNotFound,
                message: 'survey.error.recipientNotFound',
            });
        }

        return { survey, recipient };
    }
}
