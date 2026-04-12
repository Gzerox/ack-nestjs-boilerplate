import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormCreateDraftResponseDto } from '@modules/trip-form/dtos/response/trip-form-create-draft.response.dto';
import { TripFormAssignmentResponseDto } from '@modules/trip-form/dtos/response/trip-form-assignment.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormMetricsResponseDto } from '@modules/trip-form/dtos/response/trip-form-metrics.response.dto';
import { TripFormCreateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-create-draft.request.dto';
import { TripFormUpdateDraftRequestDto } from '@modules/trip-form/dtos/request/trip-form-update-draft.request.dto';
import { TripFormAssignmentCreateRequestDto } from '@modules/trip-form/dtos/request/trip-form-assignment-create.request.dto';

export function TripFormSharedCreateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create trip form draft' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripFormCreateDraftRequestDto }),
        DocResponse<TripFormCreateDraftResponseDto>('trip-form.createDraft', { dto: TripFormCreateDraftResponseDto, httpStatus: HttpStatus.CREATED })
    );
}

export function TripFormSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip form list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TripFormResponseDto>('trip-form.list', { dto: TripFormResponseDto })
    );
}

export function TripFormSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip form detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripFormResponseDto>('trip-form.get', { dto: TripFormResponseDto })
    );
}

export function TripFormSharedUpdateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update draft trip form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripFormUpdateDraftRequestDto }),
        DocResponse<TripFormResponseDto>('trip-form.update', { dto: TripFormResponseDto })
    );
}

export function TripFormSharedPublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'publish trip form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripFormCreateDraftResponseDto>('trip-form.publish', { dto: TripFormCreateDraftResponseDto })
    );
}

export function TripFormSharedCreateAssignmentDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create trip form assignment' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripFormAssignmentCreateRequestDto }),
        DocResponse<TripFormAssignmentResponseDto>('trip-form.assignment.create', { dto: TripFormAssignmentResponseDto, httpStatus: HttpStatus.CREATED })
    );
}

export function TripFormSharedArchiveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'archive trip form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip-form.archive')
    );
}

export function TripFormSharedDeleteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'delete trip form' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip-form.delete')
    );
}

export function TripFormSharedMetricsDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip form metrics' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripFormMetricsResponseDto>('trip-form.metrics', { dto: TripFormMetricsResponseDto })
    );
}

export function TripFormSharedResponsesDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'list trip form responses' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TripFormResponseResponseDto>('trip-form.response.list', { dto: TripFormResponseResponseDto })
    );
}

