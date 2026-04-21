import { DatabaseService } from '@common/database/services/database.service';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import {
    TenantContactSeedRecord,
    migrationTenantContactData,
} from '@migration/data/migration.tenant-contact.data';
import { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { Logger } from '@nestjs/common';
import { Command } from 'nest-commander';
import {
    SEED_TENANT_ID,
    SEED_USER_EMAIL,
} from '@migration/constants/migration.seed.constant';

@Command({
    name: 'tenant-contact',
    description: 'Seed/Remove TenantContacts',
    allowUnknownOptions: false,
})
export class MigrationTenantContactSeed
    extends MigrationSeedBase
    implements IMigrationSeed
{
    private readonly logger = new Logger(MigrationTenantContactSeed.name);

    constructor(private readonly databaseService: DatabaseService) {
        super();
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding TenantContacts...');
        this.logger.log(
            `Found ${migrationTenantContactData.length} contacts to seed.`
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
            for (const record of migrationTenantContactData) {
                await this.seedOne(record, seedUser.id);
            }
        } catch (error: unknown) {
            this.logger.error(error, 'Error seeding tenant contacts');
            throw error;
        }

        this.logger.log('TenantContacts seeded successfully.');
    }

    private async seedOne(
        record: TenantContactSeedRecord,
        createdBy: string
    ): Promise<void> {
        if (record.email) {
            const existing = await this.databaseService.tenantContact.findFirst({
                where: {
                    email: record.email,
                    tenantId: SEED_TENANT_ID,
                    deletedAt: null,
                },
                select: { id: true },
            });

            if (existing) {
                await this.databaseService.tenantContact.update({
                    where: { id: existing.id },
                    data: {
                        firstName: record.firstName,
                        lastName: record.lastName,
                        category: record.category ?? null,
                        phone: record.phone ?? null,
                        notes: record.notes ?? null,
                    },
                });
                return;
            }
        }

        await this.databaseService.tenantContact.create({
            data: {
                tenantId: SEED_TENANT_ID,
                createdBy,
                firstName: record.firstName,
                lastName: record.lastName,
                category: record.category ?? null,
                phone: record.phone ?? null,
                email: record.email ?? null,
                notes: record.notes ?? null,
            },
        });
    }

    async remove(): Promise<void> {
        this.logger.log('Removing TenantContacts...');

        try {
            await this.databaseService.tenantContact.deleteMany({
                where: { tenantId: SEED_TENANT_ID },
            });
        } catch (error: unknown) {
            this.logger.error(error, 'Error removing tenant contacts');
            throw error;
        }

        this.logger.log('TenantContacts removed successfully.');
    }
}
