import { Global, Module } from '@nestjs/common';
import { AuthService } from '@modules/auth/services/auth.service';
import { IsTwoFactorBackupCodeConstraint } from '@modules/auth/validations/auth.two-factor-backup-code.validation';
import { IsTwoFactorCodeConstraint } from '@modules/auth/validations/auth.two-factor-code.validation';
import { AuthUtil } from '@modules/auth/utils/auth.util';
import { AuthTwoFactorUtil } from '@modules/auth/utils/auth.two-factor.util';
import { betterAuthInstance } from '@modules/auth/services/auth.better.factory';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';

@Global()
@Module({
    providers: [
        IsTwoFactorCodeConstraint,
        IsTwoFactorBackupCodeConstraint,

        AuthService,
        AuthUtil,
        AuthTwoFactorUtil,
    ],
    exports: [AuthService, AuthUtil, AuthTwoFactorUtil],
    controllers: [],
    imports: [
        BetterAuthModule.forRoot({
            auth: betterAuthInstance,
            isGlobal: true,
            disableGlobalAuthGuard: true,
            disableControllers: true,
        }),
    ],
})
export class AuthModule {}
