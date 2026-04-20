import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    Prisma,
    TripInvite,
    TripInviteStatus,
    TripStatus,
} from '@generated/prisma-client';
import {
    ITripInviteIdentify,
    ITripInviteWithTrip,
} from '@modules/trip/interfaces/trip-invite.interface';

@Injectable()
export class TripInviteRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async createMany(data: Prisma.TripInviteCreateManyInput[]): Promise<void> {
        await this.databaseService.tripInvite.createMany({ data });
    }

    async findOneByIdAndTrip(
        inviteId: string,
        tripId: string
    ): Promise<TripInvite | null> {
        return this.databaseService.tripInvite.findFirst({
            where: { id: inviteId, tripId },
        });
    }

    async findOneByTokenHash(tokenHash: string): Promise<TripInvite | null> {
        return this.databaseService.tripInvite.findUnique({
            where: { tokenHash },
        });
    }

    async findOneByTripSlugAndEmail(
        tripSlug: string,
        email: string
    ): Promise<ITripInviteIdentify | null> {
        return this.databaseService.tripInvite.findFirst({
            where: {
                email,
                trip: {
                    slug: tripSlug,
                    status: TripStatus.published,
                    deletedAt: null,
                },
            },
            select: {
                id: true,
                tripId: true,
                email: true,
                userId: true,
                status: true,
                expiresAt: true,
            },
        });
    }

    async findManyByTrip(tripId: string): Promise<TripInvite[]> {
        return this.databaseService.tripInvite.findMany({
            where: { tripId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async findManyByUser(
        userId: string,
        email: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripInviteSelect,
            Prisma.TripInviteWhereInput
        >
    ): Promise<IResponsePagingReturn<ITripInviteWithTrip>> {
        return this.paginationService.offset<
            ITripInviteWithTrip,
            Prisma.TripInviteSelect,
            Prisma.TripInviteWhereInput
        >(this.databaseService.tripInvite, {
            ...pagination,
            where: {
                ...pagination.where,
                OR: [{ userId }, { email }],
            },
            include: {
                trip: {
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        subtitle: true,
                        icon: true,
                        coverImage: true,
                        startDate: true,
                        endDate: true,
                        timezone: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
    }

    async accept(
        inviteId: string,
        userId: string,
        acceptedAt: Date
    ): Promise<TripInvite> {
        return this.databaseService.tripInvite.update({
            where: { id: inviteId },
            data: { status: TripInviteStatus.accepted, userId, acceptedAt },
        });
    }

    async revoke(
        inviteId: string,
        revokedBy: string,
        revokedAt: Date
    ): Promise<TripInvite> {
        return this.databaseService.tripInvite.update({
            where: { id: inviteId },
            data: { status: TripInviteStatus.revoked, revokedBy, revokedAt },
        });
    }

    async existsByTripAndEmail(
        tripId: string,
        email: string
    ): Promise<boolean> {
        const record = await this.databaseService.tripInvite.findFirst({
            where: { tripId, email },
            select: { id: true },
        });
        return record !== null;
    }

    async acceptWithTraveler(
        inviteId: string,
        userId: string,
        tripId: string,
        acceptedAt: Date
    ): Promise<void> {
        await this.databaseService.$transaction(async tx => {
            await tx.tripInvite.update({
                where: { id: inviteId },
                data: { status: TripInviteStatus.accepted, userId, acceptedAt },
            });

            //TODO: existing == true should never happen, the tripTraveler is only created during the accept invite.
            const existing = await tx.tripTraveler.findFirst({
                where: { tripId, userId },
                select: { id: true },
            });

            if (!existing) {
                await tx.tripTraveler.create({
                    data: { tripId, userId, createdBy: userId },
                });
            }
        });
    }
}
