import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';

@Injectable()
export class TripContactRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async replaceAll(tripId: string, contactIds: string[]): Promise<void> {
        await this.databaseService.tripContact.deleteMany({
            where: { tripId },
        });

        if (!contactIds.length) {
            return;
        }

        await this.databaseService.tripContact.createMany({
            data: contactIds.map(contactId => ({
                tripId,
                contactId,
            })),
        });
    }
}
