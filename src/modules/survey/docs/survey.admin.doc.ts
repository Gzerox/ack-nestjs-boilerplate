import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocGuard,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { SurveyTemplateResponseDto } from '@modules/survey/dtos/response/survey-template.response.dto';
import { SurveyResponseDto } from '@modules/survey/dtos/response/survey.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

export function SurveyAdminTemplateListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get all survey templates',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponsePaging<SurveyTemplateResponseDto>('survey.template.list', {
            dto: SurveyTemplateResponseDto,
        })
    );
}

export function SurveyAdminTemplateGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get detail survey template',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyTemplateResponseDto>('survey.template.get', {
            dto: SurveyTemplateResponseDto,
        })
    );
}

export function SurveyAdminTemplateCreateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'create survey template',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyTemplateResponseDto>('survey.template.create', {
            dto: SurveyTemplateResponseDto,
            statusCode: HttpStatus.CREATED,
        })
    );
}

export function SurveyAdminTemplateUpdateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'update survey template',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyTemplateResponseDto>('survey.template.update', {
            dto: SurveyTemplateResponseDto,
        })
    );
}

export function SurveyAdminTemplateDeactivateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'deactivate survey template',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse('survey.template.deactivate', { statusCode: HttpStatus.NO_CONTENT })
    );
}

export function SurveyAdminListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get all surveys',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponsePaging<SurveyResponseDto>('survey.list', {
            dto: SurveyResponseDto,
        })
    );
}

export function SurveyAdminGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get detail survey',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyResponseDto>('survey.get', {
            dto: SurveyResponseDto,
        })
    );
}

export function SurveyAdminCreateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'create survey',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<any>('survey.create', {
            statusCode: HttpStatus.CREATED,
        })
    );
}

export function SurveyAdminCloseDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'close survey',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyResponseDto>('survey.close', {
            dto: SurveyResponseDto,
        })
    );
}

export function SurveyAdminRecipientListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get survey recipients',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponsePaging<SurveyRecipientResponseDto>('survey.recipient.list', {
            dto: SurveyRecipientResponseDto,
        })
    );
}

export function SurveyAdminRecipientGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({
            summary: 'get survey recipient',
        }),
        DocAuth({
            xApiKey: true,
            jwtAccessToken: true,
        }),
        DocGuard({ role: true, policy: true }),
        DocResponse<SurveyRecipientResponseDto>('survey.recipient.get', {
            dto: SurveyRecipientResponseDto,
        })
    );
}
