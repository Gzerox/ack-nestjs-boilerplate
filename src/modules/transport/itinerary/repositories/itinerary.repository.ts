import { DatabaseService } from '@common/database/services/database.service';
import { Injectable } from '@nestjs/common';
import { TransportItinerary } from '@generated/prisma-client';
import { EnumFlightDirection } from '@modules/transport/itinerary/enums/itinerary.enum';
import {
    ITransportFlightSegment,
    ITransportItineraryWithSegments,
} from '@modules/transport/itinerary/interfaces/itinerary.interface';

@Injectable()
export class ItineraryRepository {
    constructor(
        private readonly databaseService: DatabaseService
    ) {}

    async tripExists(tripId: string): Promise<boolean> {
        const record = await this.databaseService.trip.findFirst({
            where: { id: tripId },
            select: { id: true },
        });
        return record !== null;
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
            tripId: string;
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
