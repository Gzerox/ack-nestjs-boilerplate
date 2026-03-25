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
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormCreateDraftResponseDto } from '@modules/form/dtos/response/form-create-draft.response.dto';
import { FormAssignmentResponseDto } from '@modules/form/dtos/response/form-assignment.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormMetricsResponseDto } from '@modules/form/dtos/response/form-metrics.response.dto';
import { FormQuestionSummaryResponseDto } from '@modules/form/dtos/response/form-question-summary.response.dto';
import { FormCreateDraftRequestDto } from '@modules/form/dtos/request/form-create-draft.request.dto';
import { FormUpdateDraftRequestDto } from '@modules/form/dtos/request/form-update-draft.request.dto';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';

export function FormSharedCreateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create form draft' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: FormCreateDraftRequestDto }),
        DocResponse<FormCreateDraftResponseDto>('form.createDraft', { dto: FormCreateDraftResponseDto })
    );
}

export function FormSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get form list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponsePaging<FormResponseDto>('form.list', { dto: FormResponseDto })
    );
}

export function FormSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get form detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<FormResponseDto>('form.get', { dto: FormResponseDto })
    );
}

export function FormSharedUpdateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update draft form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: FormUpdateDraftRequestDto }),
        DocResponse<FormResponseDto>('form.update', { dto: FormResponseDto })
    );
}

export function FormSharedPublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'publish form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<FormCreateDraftResponseDto>('form.publish', { dto: FormCreateDraftResponseDto })
    );
}

export function FormSharedCreateAssignmentDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create form assignment' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: FormAssignmentCreateRequestDto }),
        DocResponse<FormAssignmentResponseDto>('form.assignment.create', { dto: FormAssignmentResponseDto })
    );
}

export function FormSharedArchiveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'archive form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse('form.archive')
    );
}

export function FormSharedDeleteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'delete form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true })
    );
}

export function FormSharedMetricsDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get form metrics' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<FormMetricsResponseDto>('form.metrics', { dto: FormMetricsResponseDto })
    );
}

export function FormSharedResponsesDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'list form responses' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponsePaging<FormResponseResponseDto>('form.response.list', { dto: FormResponseResponseDto })
    );
}

export function FormSharedQuestionSummaryDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get question answer summary' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ role: true }),
        DocResponse<FormQuestionSummaryResponseDto>('form.question.summary', { dto: FormQuestionSummaryResponseDto })
    );
}
