import { Module } from '@nestjs/common';
import { SurveyService } from './services/survey.service';
import { SurveyTemplateRepository } from './repositories/survey-template.repository';
import { SurveyRepository } from './repositories/survey.repository';
import { SurveyRecipientRepository } from './repositories/survey-recipient.repository';
import { SurveyUtil } from './utils/survey.util';

@Module({
    imports: [],
    exports: [
        SurveyService,
        SurveyTemplateRepository,
        SurveyRepository,
        SurveyRecipientRepository,
        SurveyUtil,
    ],
    providers: [
        SurveyService,
        SurveyTemplateRepository,
        SurveyRepository,
        SurveyRecipientRepository,
        SurveyUtil,
    ],
    controllers: [],
})
export class SurveyModule {}
