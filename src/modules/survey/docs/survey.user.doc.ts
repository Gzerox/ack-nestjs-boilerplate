import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocGuard,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';
import { SurveyWithRecipientResponseDto } from '@modules/survey/dtos/response/survey-with-recipient.response.dto';

export function SurveyUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my survey list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponsePaging<SurveyRecipientResponseDto>('survey.list', {
            dto: SurveyRecipientResponseDto,
        })
    );
}

export function SurveyUserGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponse<SurveyWithRecipientResponseDto>('survey.get', {
            dto: SurveyWithRecipientResponseDto,
        })
    );
}

export function SurveyUserSubmitDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'submit survey' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponse<SurveyRecipientResponseDto>('survey.submit', {
            dto: SurveyRecipientResponseDto,
        })
    );
}
