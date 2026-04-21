import { DatabaseService } from '@common/database/services/database.service';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import {
    ItinerarySeedRecord,
    migrationItineraryData,
} from '@migration/data/migration.itinerary.data';
import { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { Logger } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { Command } from 'nest-commander';
import {
    SEED_TENANT_ID,
    SEED_USER_EMAIL,
} from '@migration/constants/migration.seed.constant';

@Command({
    name: 'itinerary',
    description: 'Seed/Remove Itineraries',
    allowUnknownOptions: false,
})
export class MigrationItinerarySeed
    extends MigrationSeedBase
    implements IMigrationSeed
{
    private readonly logger = new Logger(MigrationItinerarySeed.name);

    constructor(private readonly databaseService: DatabaseService) {
        super();
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding Itineraries...');
        this.logger.log(
            `Found ${migrationItineraryData.length} Itineraries to seed.`
        );

        const seedUser = await this.databaseService.user.findFirst({
            where: { email: SEED_USER_EMAIL },
            select: { id: true },
        });

        if (!seedUser) {
            this.logger.error(
                `Seed user "${SEED_USER_EMAIL}" not found — run the user seeder first.`
            );
            return;
        }

        try {
            for (const record of migrationItineraryData) {
                await this.seedOne(record, seedUser.id);
            }
        } catch (error: unknown) {
            this.logger.error(error, 'Error seeding itineraries');
            throw error;
        }

        this.logger.log('Itineraries seeded successfully.');
    }

    private async seedOne(
        record: ItinerarySeedRecord,
        createdBy: string
    ): Promise<void> {
        const iataSet = new Set(
            record.segments.flatMap(s => [s.departIata, s.arriveIata])
        );
        const airports = await this.databaseService.airport.findMany({
            where: { iataCode: { in: [...iataSet] } },
            select: { id: true, iataCode: true },
        });

        const airportMap = new Map(airports.map(a => [a.iataCode, a.id]));

        for (const iata of iataSet) {
            if (!airportMap.has(iata)) {
                this.logger.warn(
                    `Airport ${iata} not found — skipping itinerary "${record.name}"`
                );
                return;
            }
        }

        // Get or create the default seed trip
        let trip = await this.databaseService.trip.findFirst({
            where: { slug: 'seed-default-trip' },
            select: { id: true },
        });

        if (!trip) {
            trip = await this.databaseService.trip.create({
                data: {
                    slug: 'seed-default-trip',
                    title: 'Default Seed Trip',
                    startDate: new Date('2026-06-15'),
                    endDate: new Date('2026-06-20'),
                    tenantId: SEED_TENANT_ID,
                    createdBy,
                },
                select: { id: true },
            });
        }

        const segments: Prisma.TransportFlightSegmentCreateWithoutItineraryInput[] =
            record.segments.map(seg => ({
                flightNumber: seg.flightNumber,
                airline: seg.airline ?? null,
                departAirport: {
                    connect: { id: airportMap.get(seg.departIata)! },
                },
                arriveAirport: {
                    connect: { id: airportMap.get(seg.arriveIata)! },
                },
                departAt: new Date(seg.departAt),
                arriveAt: new Date(seg.arriveAt),
                bookingRef: seg.bookingRef ?? null,
                notes: seg.notes ?? null,
            }));

        const existing =
            await this.databaseService.transportItinerary.findFirst({
                where: { name: record.name },
                select: { id: true },
            });

        if (existing) {
            await this.databaseService.transportItinerary.update({
                where: { id: existing.id },
                data: {
                    direction: record.direction,
                    segments: {
                        deleteMany: {},
                        create: segments,
                    },
                },
            });
        } else {
            await this.databaseService.transportItinerary.create({
                data: {
                    name: record.name,
                    direction: record.direction,
                    tripId: trip.id,
                    createdBy,
                    segments: { create: segments },
                },
            });
        }
    }

    async remove(): Promise<void> {
        this.logger.log('Removing Itineraries...');

        try {
            await this.databaseService.transportItinerary.deleteMany({});
        } catch (error: unknown) {
            this.logger.error(error, 'Error removing itineraries');
            throw error;
        }

        this.logger.log('Itineraries removed successfully.');
    }
}
