import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Injectable } from '@nestjs/common';
import { Prisma, TransportItinerary } from '@generated/prisma-client';
import { EnumFlightDirection } from '@modules/transport/itinerary/enums/itinerary.enum';
import {
    ITransportFlightSegment,
    ITransportItineraryWithSegments,
} from '@modules/transport/itinerary/interfaces/itinerary.interface';

@Injectable()
export class ItineraryRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findWithPaginationOffset(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        direction?: Record<string, IPaginationIn>
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
        return this.databaseService.transportItinerary.findUnique({
            where: { id },
        });
    }

    async findOneWithSegments(
        id: string
    ): Promise<ITransportItineraryWithSegments | null> {
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

    async createWithSegments(
        data: {
            name: string;
            direction: EnumFlightDirection;
        },
        segments: ITransportFlightSegment[],
        createdBy: string
    ): Promise<ITransportItineraryWithSegments> {
        return this.databaseService.transportItinerary.create({
            data: {
                ...data,
                createdBy,
                segments: {
                    create: segments.map(
                        ({ departAirportId, arriveAirportId, ...segment }) => ({
                            ...segment,
                            departAirport: {
                                connect: { id: departAirportId },
                            },
                            arriveAirport: {
                                connect: { id: arriveAirportId },
                            },
                            createdBy,
                        })
                    ),
                },
            },
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
