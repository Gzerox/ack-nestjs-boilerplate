import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { TermsPolicyService } from '@modules/terms-policy/services/terms-policy.service';
import { TermsPolicyGetRequestDto } from '@modules/terms-policy/dtos/request/terms-policy.get.request.dto';
import { TermsPolicyGetResponseDto } from '@modules/terms-policy/dtos/response/terms-policy.get.response.dto';
import { IResponse } from '@common/response/interfaces/response.interface';
import { ENUM_TERMS_POLICY_STATUS_CODE_ERROR } from '@modules/terms-policy/enums/terms-policy.status-code.enum';
import { ENUM_MESSAGE_LANGUAGE } from '@common/message/enums/message.enum';
import { RequestLanguage } from '@common/request/decorators/request.decorator';

@ApiTags('modules.public.terms-policy')
@Controller({
    version: '1',
    path: '/terms-policy',
})
export class TermsPolicyPublicController {
    constructor(private readonly termsPolicyService: TermsPolicyService) {}

    @Get('/latest')
    async getLatestPublicPolicy(
        @Query() request: TermsPolicyGetRequestDto,
        @RequestLanguage() language: ENUM_MESSAGE_LANGUAGE
    ): Promise<IResponse<TermsPolicyGetResponseDto>> {
        const policy = await this.termsPolicyService.findLatestPublished(
            request.type,
            language
        );

        if (!policy) {
            throw new NotFoundException({
                statusCode: ENUM_TERMS_POLICY_STATUS_CODE_ERROR.NOT_FOUND,
                message: 'terms-policy.error.notFound',
            });
        }

        return {
            data: this.termsPolicyService.mapGet(policy, {
                excludeExtraneousValues: true,
            }),
        };
    }
}