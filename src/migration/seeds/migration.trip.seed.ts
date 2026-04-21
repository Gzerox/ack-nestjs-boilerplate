import { DatabaseService } from '@common/database/services/database.service';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import {
    TripSeedItinerary,
    TripSeedRecord,
    migrationTripData,
} from '@migration/data/migration.trip.data';
import { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { Logger } from '@nestjs/common';
import { Prisma, TripStatus } from '@generated/prisma-client';
import { Command } from 'nest-commander';
import {
    SEED_TENANT_ID,
    SEED_USER_EMAIL,
} from '@migration/constants/migration.seed.constant';

@Command({
    name: 'trip',
    description: 'Seed/Remove Trips',
    allowUnknownOptions: false,
})
export class MigrationTripSeed extends MigrationSeedBase implements IMigrationSeed {
    private readonly logger = new Logger(MigrationTripSeed.name);

    constructor(private readonly databaseService: DatabaseService) {
        super();
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding Trips...');
        this.logger.log(`Found ${migrationTripData.length} trips to seed.`);

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
            for (const record of migrationTripData) {
                await this.seedOne(record, seedUser.id);
            }
        } catch (error: unknown) {
            this.logger.error(error, 'Error seeding trips');
            throw error;
        }

        this.logger.log('Trips seeded successfully.');
    }

    private async seedOne(record: TripSeedRecord, createdBy: string): Promise<void> {
        const contactIds = await this.resolveContactIds(record);
        const airportMap = await this.resolveAirportMap(record);

        if (airportMap === null) {
            return;
        }

        const existing = await this.databaseService.trip.findFirst({
            where: { slug: record.slug },
            select: { id: true },
        });

        if (existing) {
            await this.updateTrip(existing.id, record, createdBy, contactIds, airportMap);
            this.logger.log(`Trip "${record.slug}" updated.`);
        } else {
            await this.createTrip(record, createdBy, contactIds, airportMap);
            this.logger.log(`Trip "${record.slug}" created.`);
        }
    }

    private async resolveContactIds(record: TripSeedRecord): Promise<string[]> {
        if (!record.contactEmails?.length) {
            return [];
        }

        const contacts = await this.databaseService.tenantContact.findMany({
            where: {
                email: { in: record.contactEmails },
                tenantId: SEED_TENANT_ID,
                deletedAt: null,
            },
            select: { id: true, email: true },
        });

        const foundEmails = new Set(contacts.map(c => c.email));
        for (const email of record.contactEmails) {
            if (!foundEmails.has(email)) {
                this.logger.warn(
                    `TenantContact "${email}" not found — skipping contact for trip "${record.slug}"`
                );
            }
        }

        return contacts.map(c => c.id);
    }

    private async resolveAirportMap(
        record: TripSeedRecord
    ): Promise<Map<string, string> | null> {
        if (!record.itineraries?.length) {
            return new Map();
        }

        const iataSet = new Set(
            record.itineraries.flatMap(it =>
                it.segments.flatMap(s => [s.departIata, s.arriveIata])
            )
        );

        const airports = await this.databaseService.airport.findMany({
            where: { iataCode: { in: [...iataSet] } },
            select: { id: true, iataCode: true },
        });

        const airportMap = new Map(airports.map(a => [a.iataCode, a.id]));

        for (const iata of iataSet) {
            if (!airportMap.has(iata)) {
                this.logger.warn(
                    `Airport "${iata}" not found — skipping itineraries for trip "${record.slug}"`
                );
                return null;
            }
        }

        return airportMap;
    }

    private async createTrip(
        record: TripSeedRecord,
        createdBy: string,
        contactIds: string[],
        airportMap: Map<string, string>
    ): Promise<void> {
        await this.databaseService.trip.create({
            data: {
                slug: record.slug,
                tenantId: SEED_TENANT_ID,
                createdBy,
                title: record.title,
                subtitle: record.subtitle ?? null,
                description: record.description ?? null,
                startDate: new Date(record.startDate),
                endDate: new Date(record.endDate),
                timezone: record.timezone ?? null,
                status: TripStatus.draft,
                deletedAt: null,
                ...(record.calendarEvents?.length && {
                    calendarEvents: {
                        create: this.buildCalendarEventCreateData(record, createdBy),
                    },
                }),
                ...(contactIds.length && {
                    contacts: {
                        create: contactIds.map(contactId => ({
                            contact: { connect: { id: contactId } },
                        })),
                    },
                }),
                ...(record.itineraries?.length && {
                    itineraries: {
                        create: this.buildItineraryCreateData(
                            record.itineraries,
                            createdBy,
                            airportMap
                        ),
                    },
                }),
            },
        });
    }

    private async updateTrip(
        tripId: string,
        record: TripSeedRecord,
        createdBy: string,
        contactIds: string[],
        airportMap: Map<string, string>
    ): Promise<void> {
        await this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                title: record.title,
                subtitle: record.subtitle ?? null,
                description: record.description ?? null,
                startDate: new Date(record.startDate),
                endDate: new Date(record.endDate),
                timezone: record.timezone ?? null,
                calendarEvents: {
                    deleteMany: { tripId },
                    ...(record.calendarEvents?.length && {
                        create: this.buildCalendarEventCreateData(record, createdBy),
                    }),
                },
                contacts: {
                    deleteMany: { tripId },
                    ...(contactIds.length && {
                        create: contactIds.map(contactId => ({
                            contact: { connect: { id: contactId } },
                        })),
                    }),
                },
                itineraries: {
                    deleteMany: { tripId },
                    ...(record.itineraries?.length && {
                        create: this.buildItineraryCreateData(
                            record.itineraries,
                            createdBy,
                            airportMap
                        ),
                    }),
                },
            },
        });
    }

    private buildCalendarEventCreateData(
        record: TripSeedRecord,
        createdBy: string
    ): Prisma.TripCalendarEventCreateWithoutTripInput[] {
        return (record.calendarEvents ?? []).map(e => ({
            createdBy,
            title: e.title,
            category: e.category,
            startsAt: e.startsAt ? new Date(e.startsAt) : null,
            endsAt: e.endsAt ? new Date(e.endsAt) : null,
            location: e.location ?? null,
            description: e.description ?? null,
        }));
    }

    private buildItineraryCreateData(
        itineraries: TripSeedItinerary[],
        createdBy: string,
        airportMap: Map<string, string>
    ): Prisma.TransportItineraryUncheckedCreateWithoutTripInput[] {
        return itineraries.map(it => ({
            name: it.name,
            direction: it.direction,
            createdBy,
            segments: {
                create: it.segments.map(seg => ({
                    flightNumber: seg.flightNumber,
                    airline: seg.airline ?? null,
                    departAirport: {
                        connect: { id: airportMap.get(seg.departIata)! },
                    },
                    arriveAirport: {
                        connect: { id: airportMap.get(seg.arriveIata)! },
                    },
                    departAt: seg.departAt ? new Date(seg.departAt) : null,
                    arriveAt: seg.arriveAt ? new Date(seg.arriveAt) : null,
                    bookingRef: seg.bookingRef ?? null,
                    notes: seg.notes ?? null,
                    createdBy,
                })),
            },
        }));
    }

    async remove(): Promise<void> {
        this.logger.log('Removing Trips...');

        try {
            await this.databaseService.trip.deleteMany({
                where: { tenantId: SEED_TENANT_ID },
            });
        } catch (error: unknown) {
            this.logger.error(error, 'Error removing trips');
            throw error;
        }

        this.logger.log('Trips removed successfully.');
    }
}
