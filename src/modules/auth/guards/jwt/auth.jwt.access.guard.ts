import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IAuthJwtAccessTokenPayload } from '@modules/auth/interfaces/auth.interface';
import { AuthService } from '@modules/auth/services/auth.service';
import { IRequestApp } from '@common/request/interfaces/request.interface';

@Injectable()
export class AuthJwtAccessGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<IRequestApp<IAuthJwtAccessTokenPayload>>();
        const user = await this.authService.validateJwtAccessRequest(request);
        request.user = user;

        return true;
    }
}
