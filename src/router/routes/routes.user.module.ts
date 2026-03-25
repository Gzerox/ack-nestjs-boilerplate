import { UserUserController } from '@modules/user/controllers/user.user.controller';
import { UserModule } from '@modules/user/user.module';
import { FormUserController } from '@modules/form/controllers/form.user.controller';
import { FormModule } from '@modules/form/form.module';
import { Module } from '@nestjs/common';

/**
 * User routes module that provides user-specific endpoints.
 * Contains controllers for user operations that require user-level authentication and authorization.
 */
@Module({
    controllers: [UserUserController, FormUserController],
    providers: [],
    exports: [],
    imports: [UserModule, FormModule],
})
export class RoutesUserModule {}
