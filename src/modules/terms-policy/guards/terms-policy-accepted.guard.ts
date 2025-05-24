import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TERMS_POLICY_TYPE_META_KEY } from '../decorators/terms-policy.decorator';
import { TermsPolicyService } from '../services/terms-policy.service';
import { TermsPolicyAcceptanceService } from '../services/terms-policy-acceptance.service';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';
import { IRequestApp } from '@common/request/interfaces/request.interface';
import { ENUM_TERMS_POLICY_STATUS_CODE_ERROR } from '@modules/terms-policy/enums/terms-policy.status-code.enum';

@Injectable()
export class TermsPolicyAcceptedGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly termsPolicyService: TermsPolicyService,
        private readonly termsPolicyAcceptanceService: TermsPolicyAcceptanceService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const policyType = this.reflector.get<ENUM_TERMS_POLICY_TYPE>(
            TERMS_POLICY_TYPE_META_KEY,
            context.getHandler()
        );

        if (!policyType) {
            return true; // If no policy type is specified, skip the check
        }

        const request = context.switchToHttp().getRequest<IRequestApp>();
        const user = request.user;

        if (!user) {
            throw new UnauthorizedException({
                statusCode: 'AUTH.UNAUTHORIZED',
                message: 'auth.error.unauthorized',
            });
        }

        // Get the most recent policy of the specified type
        const latestPolicy = await this.termsPolicyService.findLatestPublished(
            policyType,
            request.__language
        );

        // If no policy exists for this type, please explode
        if (!latestPolicy) {
            throw new BadRequestException({
                statusCode: ENUM_TERMS_POLICY_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'terms-policy.error.notFound',
            });
        }

        const hasAccepted =
            await this.termsPolicyAcceptanceService.hasAcceptedPolicy(
                user.sub,
                latestPolicy.id
            );

        if (!hasAccepted) {
            throw new ForbiddenException({
                statusCode: ENUM_TERMS_POLICY_STATUS_CODE_ERROR.NOT_ACCEPTED,
                message: 'terms-policy.error.notAccepted',
                _metadata: {
                    customProperty: {
                        messageProperties: {
                            property: policyType,
                        },
                    },
                },
            });
        }

        return true;
    }
}
