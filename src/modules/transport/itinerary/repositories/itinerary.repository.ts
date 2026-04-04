import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Injectable } from '@nestjs/common';
import { Prisma, TransportItinerary } from '@generated/prisma-client';

@Injectable()
export class ItineraryRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
    ) {}

    async findWithPaginationOffset(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        direction?: Record<string, IPaginationIn>,
    ): Promise<IResponsePagingReturn<TransportItinerary>> {
        return this.paginationService.offset<
            TransportItinerary,
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >(this.databaseService.transportItinerary, {
            ...params,
            where: {
                ...where,
                ...direction,
            },
        });
    }

    async findOneById(id: string): Promise<TransportItinerary | null> {
        return this.databaseService.transportItinerary.findUnique({ where: { id } });
    }

    async findOneWithSegments(id: string) {
        return this.databaseService.transportItinerary.findUnique({
            where: { id },
            include: {
                segments: {
                    orderBy: [{ departAt: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        departAirport: true,
                        arriveAirport: true,
                    },
                },
            },
        });
    }

    async createWithSegments(data: Prisma.TransportItineraryCreateInput) {
        return this.databaseService.transportItinerary.create({
            data,
            include: {
                segments: {
                    orderBy: [{ departAt: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        departAirport: true,
                        arriveAirport: true,
                    },
                },
            },
        });
    }
}
