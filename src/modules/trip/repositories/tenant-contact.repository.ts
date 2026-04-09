import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { TenantContact } from '@generated/prisma-client';

@Injectable()
export class TenantContactRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    async findManyActiveByIdsAndTenant(
        contactIds: string[],
        tenantId: string
    ): Promise<TenantContact[]> {
        if (!contactIds.length) {
            return [];
        }

        return this.databaseService.tenantContact.findMany({
            where: {
                id: { in: contactIds },
                tenantId,
                deletedAt: null,
            },
        });
    }
}
