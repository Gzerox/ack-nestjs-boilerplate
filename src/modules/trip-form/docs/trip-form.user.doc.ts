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
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormWithResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-with-response.response.dto';
import { TripFormSubmitRequestDto } from '@modules/trip-form/dtos/request/trip-form-submit.request.dto';

export function TripFormUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my trip form list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponsePaging<TripFormResponseResponseDto>('trip-form.list', { dto: TripFormResponseResponseDto })
    );
}

export function TripFormUserGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my trip form with response' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponse<TripFormWithResponseResponseDto>('trip-form.get', { dto: TripFormWithResponseResponseDto })
    );
}

export function TripFormUserSubmitDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'submit trip form answers' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripFormSubmitRequestDto }),
        DocResponse<TripFormResponseResponseDto>('trip-form.submit', { dto: TripFormResponseResponseDto })
    );
}
