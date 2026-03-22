import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocGuard,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyPublishResponseDto } from '@modules/survey/dtos/response/survey-publish.response.dto';
import { SurveyCreateRequestDto } from '@modules/survey/dtos/request/survey.create.request.dto';
import { SurveyUpdateRequestDto } from '@modules/survey/dtos/request/survey.update.request.dto';

export function SurveySharedPublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'publish survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocRequest({
            bodyType: EnumDocRequestBodyType.json,
            dto: SurveyCreateRequestDto,
        }),
        DocResponse<SurveyPublishResponseDto>('survey.publish', { dto: SurveyPublishResponseDto })
    );
}

export function SurveySharedUpdateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update draft survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocRequest({
            bodyType: EnumDocRequestBodyType.json,
            dto: SurveyUpdateRequestDto,
        }),
        DocResponse<SurveyResponseDto>('survey.update', { dto: SurveyResponseDto })
    );
}

export function SurveySharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get survey list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponsePaging<SurveyResponseDto>('survey.list', {
            dto: SurveyResponseDto,
        })
    );
}

export function SurveySharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get survey detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<SurveyResponseDto>('survey.get', { dto: SurveyResponseDto })
    );
}

export function SurveySharedArchiveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'archive survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse('survey.archive')
    );
}

export function SurveySharedDeleteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'delete survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true })
    );
}

export function SurveySharedRecipientListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get survey recipients' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponsePaging<SurveyRecipientResponseDto>('survey.recipient.list', {
            dto: SurveyRecipientResponseDto,
        })
    );
}

export function SurveySharedRecipientGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get survey recipient' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<SurveyRecipientResponseDto>('survey.recipient.get', {
            dto: SurveyRecipientResponseDto,
        })
    );
}
