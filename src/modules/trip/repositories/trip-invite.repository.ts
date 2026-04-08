import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { Prisma, TripInvite } from '@generated/prisma-client';

@Injectable()
export class TripInviteRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async createMany(data: Prisma.TripInviteCreateManyInput[]): Promise<void> {
        await this.databaseService.tripInvite.createMany({ data });
    }

    async findOneByIdAndTrip(inviteId: string, tripId: string): Promise<TripInvite | null> {
        return this.databaseService.tripInvite.findFirst({
            where: { id: inviteId, tripId },
        });
    }

    async findOneByTokenHash(tokenHash: string): Promise<TripInvite | null> {
        return this.databaseService.tripInvite.findUnique({
            where: { tokenHash },
        });
    }

    async findManyByTrip(tripId: string): Promise<TripInvite[]> {
        return this.databaseService.tripInvite.findMany({
            where: { tripId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async accept(inviteId: string, userId: string, acceptedAt: Date): Promise<TripInvite> {
        return this.databaseService.tripInvite.update({
            where: { id: inviteId },
            data: { status: 'ACCEPTED', userId, acceptedAt },
        });
    }

    async revoke(inviteId: string, revokedBy: string, revokedAt: Date): Promise<TripInvite> {
        return this.databaseService.tripInvite.update({
            where: { id: inviteId },
            data: { status: 'REVOKED', revokedBy, revokedAt },
        });
    }

    async existsByTripAndEmail(tripId: string, email: string): Promise<boolean> {
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
                data: { status: 'ACCEPTED', userId, acceptedAt },
            });

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
