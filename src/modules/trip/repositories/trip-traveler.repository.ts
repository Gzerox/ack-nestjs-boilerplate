import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { ITripTravelerWithUser } from '@modules/trip/interfaces/trip-traveler.interface';

@Injectable()
export class TripTravelerRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findManyByTrip(
        tripId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripTravelerSelect, Prisma.TripTravelerWhereInput>
    ): Promise<IResponsePagingReturn<ITripTravelerWithUser>> {
        return this.paginationService.offset<
            ITripTravelerWithUser,
            Prisma.TripTravelerSelect,
            Prisma.TripTravelerWhereInput
        >(this.databaseService.tripTraveler, {
            ...pagination,
            where: {
                ...pagination.where,
                tripId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true,
                    },
                },
            }
        });
    }

    async findOneByTripAndId(tripId: string, travelerId: string): Promise<ITripTravelerWithUser | null> {
        return this.databaseService.tripTraveler.findFirst({
            where: { id: travelerId, tripId },
            select: {
                id: true,
                tripId: true,
                userId: true,
                groupId: true,
                createdBy: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true,
                    },
                },
            },
        }) as unknown as Promise<ITripTravelerWithUser | null>;
    }

    async existsByTripAndUser(tripId: string, userId: string): Promise<boolean> {
        const record = await this.databaseService.tripTraveler.findFirst({
            where: { tripId, userId },
            select: { id: true },
        });
        return record !== null;
    }
}
