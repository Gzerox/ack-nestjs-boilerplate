import { UserUserController } from '@modules/user/controllers/user.user.controller';
import { UserModule } from '@modules/user/user.module';
import { SurveyUserController } from '@modules/survey/controllers/survey.user.controller';
import { SurveyModule } from '@modules/survey/survey.module';
import { Module } from '@nestjs/common';

/**
 * User routes module that provides user-specific endpoints.
 * Contains controllers for user operations that require user-level authentication and authorization.
 */
@Module({
    controllers: [UserUserController, SurveyUserController],
    providers: [],
    exports: [],
    imports: [UserModule, SurveyModule],
})
export class RoutesUserModule {}
