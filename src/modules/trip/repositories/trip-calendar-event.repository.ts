import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { Prisma, TripCalendarEvent } from '@generated/prisma-client';

@Injectable()
export class TripCalendarEventRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async createMany(data: Prisma.TripCalendarEventCreateManyInput[]): Promise<void> {
        await this.databaseService.tripCalendarEvent.createMany({ data });
    }

    async deleteByTrip(tripId: string): Promise<void> {
        await this.databaseService.tripCalendarEvent.deleteMany({ where: { tripId } });
    }

    async findManyByTrip(tripId: string): Promise<TripCalendarEvent[]> {
        return this.databaseService.tripCalendarEvent.findMany({
            where: { tripId },
            orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
        });
    }
}
