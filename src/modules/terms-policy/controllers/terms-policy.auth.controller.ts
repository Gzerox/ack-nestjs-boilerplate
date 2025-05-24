import { ApiTags } from '@nestjs/swagger';
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    NotFoundException,
    Post,
} from '@nestjs/common';
import { TermsPolicyService } from '@modules/terms-policy/services/terms-policy.service';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { IUserDoc } from '@modules/user/interfaces/user.interface';
import { TermsPolicyUserService } from '@modules/terms-policy/services/terms-policy-user.service';
import { TermsPolicyAcceptanceService } from '@modules/terms-policy/services/terms-policy-acceptance.service';
import { IResponse } from '@common/response/interfaces/response.interface';
import { TermsPolicyAccepted } from '@modules/terms-policy/decorators/terms-policy.decorator';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';
import { TermsPolicyAcceptRequestDto } from '@modules/terms-policy/dtos/request/terms-policy.accept.request.dto';
import { ENUM_TERMS_POLICY_STATUS_CODE_ERROR } from '@modules/terms-policy/enums/terms-policy.status-code.enum';
import { TermsPolicyAcceptanceGetResponseDto } from '@modules/terms-policy/dtos/response/terms-policy-acceptance.get.response.dto';
import { TermsPolicyAcceptanceListResponseDto } from '@modules/terms-policy/dtos/response/terms-policy-acceptance.list.response.dto';
import { Response } from '@common/response/decorators/response.decorator';

@ApiTags('modules.auth.terms-policy')
@Controller({
    version: '1',
    path: '/terms-policy',
})
export class TermsPolicyAuthController {
    constructor(
        private readonly termsPolicyService: TermsPolicyService,
        private readonly termsPolicyAcceptanceService: TermsPolicyAcceptanceService,
        private readonly termsPolicyUserService: TermsPolicyUserService
    ) {}

    @Get('/pending')
    @Response('terms-policy.pending')
    @UserProtected()
    @AuthJwtAccessProtected()
    async getPendingPolicies(@AuthJwtPayload('user') user: IUserDoc) {
        const policies =
            await this.termsPolicyUserService.findPendingPoliciesForUser(
                user.id
            );

        return {
            data: this.termsPolicyService.mapList(policies, {
                excludeExtraneousValues: true,
            }),
        };
    }

    @Post('/accept')
    @Response('terms-policy.accept')
    @UserProtected()
    @AuthJwtAccessProtected()
    async acceptPolicy(
        @AuthJwtPayload('user') user: IUserDoc,
        @Body() request: TermsPolicyAcceptRequestDto
    ): Promise<IResponse<TermsPolicyAcceptanceGetResponseDto>> {
        // After DTO validation succeeds, manually apply the TermsPolicyActiveParsePipe logic
        const policy = await this.termsPolicyService.findOneById(
            request.policyId
        );
        if (!policy) {
            throw new NotFoundException({
                statusCode: ENUM_TERMS_POLICY_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'http.404',
            });
        }

        if (!policy.isPublished) {
            throw new BadRequestException({
                statusCode: ENUM_TERMS_POLICY_STATUS_CODE_ERROR.NOT_ACTIVE,
                message: 'terms-policy.error.inactive',
            });
        }

        // Now use the policy document
        const accepted = await this.termsPolicyUserService.acceptPolicy(
            user.id,
            policy.id
        );

        return {
            data: this.termsPolicyAcceptanceService.mapGet(accepted, {
                excludeExtraneousValues: true,
            }),
        };
    }

    @Get('/accepted')
    @Response('terms-policy.accepted')
    @UserProtected()
    @AuthJwtAccessProtected()
    async getAcceptedPolicies(
        @AuthJwtPayload('user') user: IUserDoc
    ): Promise<IResponse<TermsPolicyAcceptanceListResponseDto[]>> {
        const acceptedPolicies =
            await this.termsPolicyAcceptanceService.getAcceptedPolicies(
                user.id
            );

        return {
            data: this.termsPolicyAcceptanceService.mapList(acceptedPolicies, {
                excludeExtraneousValues: true,
            }),
        };
    }

    @Get('/protected/terms')
    @TermsPolicyAccepted(ENUM_TERMS_POLICY_TYPE.TERMS)
    @UserProtected()
    @AuthJwtAccessProtected()
    async getProtectedByTerms() {
        return {
            message: 'You have accepted the terms of service',
        };
    }

    @Get('/protected/cookies')
    @TermsPolicyAccepted(ENUM_TERMS_POLICY_TYPE.COOKIES)
    @UserProtected()
    @AuthJwtAccessProtected()
    async getProtectedByCookies() {
        return {
            message: 'You have accepted the policy of cookies',
        };
    }

    @Get('/protected/privacy')
    @TermsPolicyAccepted(ENUM_TERMS_POLICY_TYPE.PRIVACY)
    @UserProtected()
    @AuthJwtAccessProtected()
    async getProtectedByPrivacy() {
        return {
            message: 'You have accepted the policy of privacy',
        };
    }
}
