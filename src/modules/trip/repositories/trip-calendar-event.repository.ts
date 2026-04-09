import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { Prisma } from '@generated/prisma-client';

@Injectable()
export class TripCalendarEventRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async createMany(
        data: Prisma.TripCalendarEventCreateManyInput[]
    ): Promise<void> {
        await this.databaseService.tripCalendarEvent.createMany({ data });
    }

    async deleteByTrip(tripId: string): Promise<void> {
        await this.databaseService.tripCalendarEvent.deleteMany({
            where: { tripId },
        });
    }
}
