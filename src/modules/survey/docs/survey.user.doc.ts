import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

export function SurveyUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get my survey list',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocResponsePaging<SurveyRecipientResponseDto>('survey.list', {
            dto: SurveyRecipientResponseDto,
        })
    );
}

export function SurveyUserGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get my survey',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocResponse<any>('survey.get')
    );
}

export function SurveyUserSaveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'save survey responses',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocResponse<SurveyRecipientResponseDto>('survey.save', {
            dto: SurveyRecipientResponseDto,
        })
    );
}

export function SurveyUserSubmitDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'submit survey',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocResponse<SurveyRecipientResponseDto>('survey.submit', {
            dto: SurveyRecipientResponseDto,
        })
    );
}
