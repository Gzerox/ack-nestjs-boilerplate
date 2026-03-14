import { EnumAppEnvironment } from '@app/enums/app.enum';
import { DatabaseService } from '@common/database/services/database.service';
import { MigrationSeedBase } from '@migration/bases/migration.seed.base';
import { migrationSurveyTemplateData } from '@migration/data/migration.survey-template.data';
import { IMigrationSeed } from '@migration/interfaces/migration.seed.interface';
import { SurveyTemplateCreateRequestDto } from '@modules/survey/dtos/request/survey-template.create.request.dto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command } from 'nest-commander';
import { DatabaseUtil } from '@common/database/utils/database.util';

@Command({
    name: 'surveyTemplate',
    description: 'Seed/Remove Survey Templates',
    allowUnknownOptions: false,
})
export class MigrationSurveyTemplateSeed
    extends MigrationSeedBase
    implements IMigrationSeed
{
    private readonly logger = new Logger(MigrationSurveyTemplateSeed.name);

    private readonly env: EnumAppEnvironment;
    private readonly surveyTemplates: SurveyTemplateCreateRequestDto[] = [];

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly configService: ConfigService,
        private readonly databaseUtil: DatabaseUtil
    ) {
        super();

        this.env = this.configService.get<EnumAppEnvironment>('app.env');
        this.surveyTemplates = migrationSurveyTemplateData[this.env];
    }

    async seed(): Promise<void> {
        this.logger.log('Seeding Survey Templates...');
        this.logger.log(
            `Found ${this.surveyTemplates.length} Survey Templates to seed.`
        );

        try {
            const createdBy = this.databaseUtil.createId();
            await this.databaseService.$transaction(
                this.surveyTemplates.map(template =>
                    this.databaseService.surveyTemplate.upsert({
                        where: {
                            createdBy_name: {
                                createdBy,
                                name: template.name,
                            },
                        },
                        create: {
                            createdBy,
                            name: template.name,
                            schema: template.schema as any,
                        },
                        update: {
                            schema: template.schema as any,
                        },
                    })
                )
            );
        } catch (error: unknown) {
            this.logger.error(error, 'Error seeding survey templates');
            throw error;
        }

        this.logger.log('Survey Templates seeded successfully.');

        return;
    }

    async remove(): Promise<void> {
        this.logger.log('Removing Survey Templates...');

        try {
            await this.databaseService.surveyTemplate.deleteMany({});
        } catch (error: unknown) {
            this.logger.error(error, 'Error removing survey templates');
            throw error;
        }

        this.logger.log('Survey Templates removed successfully.');

        return;
    }
}
