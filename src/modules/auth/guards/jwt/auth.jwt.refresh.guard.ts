import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IAuthJwtRefreshTokenPayload } from '@modules/auth/interfaces/auth.interface';
import { AuthService } from '@modules/auth/services/auth.service';
import { IRequestApp } from '@common/request/interfaces/request.interface';

@Injectable()
export class AuthJwtRefreshGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<IRequestApp<IAuthJwtRefreshTokenPayload>>();
        const user = await this.authService.validateJwtRefreshRequest(request);
        request.user = user;

        return true;
    }
}
