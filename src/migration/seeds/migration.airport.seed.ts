import { EnumAppEnvironment } from '@app/enums/app.enum';
import { DatabaseService } from '@common/database/services/database.service';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import { migrationAirportData } from '@migration/data/migration.airport.data';
import { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@generated/prisma-client';
import { Command } from 'nest-commander';

@Command({
    name: 'airport',
    description: 'Seed/Remove Airports',
    allowUnknownOptions: false,
})
export class MigrationAirportSeed
    extends MigrationSeedBase
    implements IMigrationSeed
{
    private readonly logger = new Logger(MigrationAirportSeed.name);

    private readonly env: EnumAppEnvironment;
    private readonly airports: Prisma.AirportCreateInput[] = [];

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly configService: ConfigService
    ) {
        super();

        this.env = this.configService.get<EnumAppEnvironment>('app.env');
        this.airports = migrationAirportData[this.env];
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding Airports...');
        this.logger.log(`Found ${this.airports.length} Airports to seed.`);

        try {
            await this.databaseService.$transaction(
                this.airports.map(airport =>
                    this.databaseService.airport.upsert({
                        where: {
                            iataCode: airport.iataCode,
                        },
                        create: airport,
                        update: {
                            icaoCode: airport.icaoCode,
                            name: airport.name,
                            shortName: airport.shortName,
                            city: airport.city,
                            country: airport.country,
                            countryCode: airport.countryCode,
                            continent: airport.continent,
                            continentCode: airport.continentCode,
                            timezone: airport.timezone,
                            currencyCode: airport.currencyCode,
                            status: airport.status,
                        },
                    })
                )
            );
        } catch (error: unknown) {
            this.logger.error(error, 'Error seeding airports');
            throw error;
        }

        this.logger.log('Airports seeded successfully.');

        return;
    }

    async remove(): Promise<void> {
        this.logger.log('Removing back Airports...');

        try {
            await this.databaseService.airport.deleteMany({
                where: {},
            });
        } catch (error: unknown) {
            this.logger.error(error, 'Error removing airports');
            throw error;
        }

        this.logger.log('Airports removed successfully.');

        return;
    }
}
