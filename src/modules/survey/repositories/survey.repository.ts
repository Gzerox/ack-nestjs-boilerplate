import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Prisma, Survey } from '@generated/prisma-client';

@Injectable()
export class SurveyRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async create(data: Prisma.SurveyCreateInput): Promise<Survey & { _count?: { recipients: number } }> {
        return this.databaseService.survey.create({ data });
    }

    async findMany(
        pagination: IPaginationQueryOffsetParams<
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >
    ): Promise<IResponsePagingReturn<Survey>> {
        return this.paginationService.offset<
            Survey,
            Prisma.SurveySelect,
            Prisma.SurveyWhereInput
        >(this.databaseService.survey, pagination);
    }

    async findById(id: string): Promise<Survey | null> {
        return this.databaseService.survey.findUnique({
            where: { id },
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey | null>;
    }

    async close(id: string): Promise<Survey> {
        return this.databaseService.survey.update({
            where: { id },
            data: { isActive: false },
            include: { _count: { select: { recipients: true } } },
        }) as Promise<Survey>;
    }
}
