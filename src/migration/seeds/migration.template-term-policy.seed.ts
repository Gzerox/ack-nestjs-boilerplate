import { DatabaseService } from '@common/database/services/database.service';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import type { IStoredAssetReference } from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import {
    EnumTermPolicyStatus,
    EnumTermPolicyType,
    Prisma,
} from '@generated/prisma-client/client';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import { MigrationUserSuperAdminId } from '@migration/data/migration.user.data';
import type { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { TermPolicyTemplateDomain } from '@modules/term-policy/domains/term-policy.template.domain';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command } from 'nest-commander';

/**
 * Uploads the term policy templates to object storage and writes their published version 1 records.
 * Removal deletes the version 1 content rows this seed wrote, then their stored objects; the term
 * policy rows stay, because the `termPolicy` seed owns that table.
 */
@Command({
    name: 'templateTermPolicy',
    description: 'Seed/Remove Term Policies',
    allowUnknownOptions: false,
})
export class MigrationTemplateTermPolicySeed
    extends MigrationSeedBase
    implements IMigrationSeed
{
    private readonly logger = new Logger(MigrationTemplateTermPolicySeed.name);

    private readonly seedTransactionTimeoutInMs: number;

    constructor(
        private readonly termPolicyTemplateDomain: TermPolicyTemplateDomain,
        private readonly databaseService: DatabaseService,
        private readonly objectStorageService: ObjectStorageService,
        private readonly configService: ConfigService
    ) {
        super();

        this.seedTransactionTimeoutInMs = this.configService.get<number>(
            'database.seedTransactionTimeoutInMs'
        )!;
    }

    private versionOneContentWhere(): Prisma.TermPolicyContentWhereInput {
        const types = Object.values(EnumTermPolicyType);

        return {
            termPolicy: {
                type: { in: types },
                version: 1,
            },
        };
    }

    private async deleteObject({
        key,
        visibility,
    }: IStoredAssetReference): Promise<void> {
        try {
            await this.objectStorageService.delete({ key, visibility });
        } catch (error: unknown) {
            this.logger.error(
                error,
                `Failed to delete ${visibility} term policy template object ${key}`
            );
        }
    }

    private async deleteObjects(
        references: IStoredAssetReference[]
    ): Promise<void> {
        await Promise.all(
            references.map(reference => this.deleteObject(reference))
        );
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding Term Policies...');

        const types = Object.values(EnumTermPolicyType);
        const results = await Promise.allSettled(
            types.map(async type => {
                const { key, visibility, contentType, size, etag } =
                    await this.termPolicyTemplateDomain.importTemplate(type);
                const contents: Prisma.TermPolicyContentCreateManyTermPolicyInput[] =
                    [
                        {
                            language: EnumMessageLanguage.en,
                            key,
                            visibility,
                            contentType,
                            size: BigInt(size),
                            etag,
                        },
                    ];

                return { type, contents };
            })
        );
        const policies = results.flatMap(result =>
            result.status === 'fulfilled' ? [result.value] : []
        );
        const importedContents = policies.flatMap(({ contents }) => contents);
        const rejected = results.find(
            (result): result is PromiseRejectedResult =>
                result.status === 'rejected'
        );
        if (rejected) {
            await this.deleteObjects(importedContents);

            throw rejected.reason;
        }

        const where = this.versionOneContentWhere();

        let previousContents: IStoredAssetReference[];
        try {
            previousContents = await this.databaseService.withTransaction(
                async tx => {
                    const rows = await tx.termPolicyContent.findMany({
                        where,
                        select: { key: true, visibility: true },
                    });

                    for (const { type, contents } of policies) {
                        await tx.termPolicy.upsert({
                            where: {
                                type_version: {
                                    type,
                                    version: 1,
                                },
                            },
                            create: {
                                type,
                                version: 1,
                                status: EnumTermPolicyStatus.published,
                                contents: { createMany: { data: contents } },
                                createdBy: MigrationUserSuperAdminId,
                                updatedBy: MigrationUserSuperAdminId,
                            },
                            update: {
                                contents: {
                                    deleteMany: {},
                                    createMany: { data: contents },
                                },
                                updatedBy: MigrationUserSuperAdminId,
                            },
                        });
                    }

                    return rows;
                },
                { timeout: this.seedTransactionTimeoutInMs }
            );
        } catch (error: unknown) {
            await this.deleteObjects(importedContents);

            throw error;
        }

        await this.deleteObjects(previousContents);

        this.logger.log('Term Policies seeded successfully.');

        return;
    }

    async remove(): Promise<void> {
        this.logger.log('Removing Term Policy templates...');

        const where = this.versionOneContentWhere();
        const contents = await this.databaseService.withTransaction(
            async tx => {
                const rows = await tx.termPolicyContent.findMany({
                    where,
                    select: { key: true, visibility: true },
                });
                await tx.termPolicyContent.deleteMany({ where });

                return rows;
            },
            { timeout: this.seedTransactionTimeoutInMs }
        );

        await this.deleteObjects(contents);

        this.logger.log('Term Policy templates removed successfully.');

        return;
    }
}
