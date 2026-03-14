import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Prisma, SurveyTemplate } from '@generated/prisma-client';

@Injectable()
export class SurveyTemplateRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(data: Prisma.SurveyTemplateCreateInput): Promise<SurveyTemplate> {
        return this.databaseService.surveyTemplate.create({ data });
    }

    async findMany(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveyTemplateSelect,
            Prisma.SurveyTemplateWhereInput
        >
    ): Promise<IResponsePagingReturn<SurveyTemplate>> {
        return this.paginationService.offset<
            SurveyTemplate,
            Prisma.SurveyTemplateSelect,
            Prisma.SurveyTemplateWhereInput
        >(this.databaseService.surveyTemplate, pagination);
    }

    async findById(id: string): Promise<SurveyTemplate | null> {
        return this.databaseService.surveyTemplate.findUnique({
            where: { id },
        });
    }

    async existByCreatedByAndName(
        createdBy: string,
        name: string
    ): Promise<boolean> {
        const existing = await this.databaseService.surveyTemplate.findFirst({
            where: { createdBy, name },
        });
        return !!existing;
    }

    async update(
        id: string,
        data: Prisma.SurveyTemplateUpdateInput
    ): Promise<SurveyTemplate> {
        return this.databaseService.surveyTemplate.update({
            where: { id },
            data,
        });
    }

    async deactivate(id: string): Promise<SurveyTemplate> {
        return this.databaseService.surveyTemplate.update({
            where: { id },
            data: { isActive: false },
        });
    }
}
