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
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormWithResponseResponseDto } from '@modules/form/dtos/response/form-with-response.response.dto';
import { FormSubmitRequestDto } from '@modules/form/dtos/request/form-submit.request.dto';

export function FormUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my form list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponsePaging<FormResponseResponseDto>('form.list', { dto: FormResponseResponseDto })
    );
}

export function FormUserGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get my form with response' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocResponse<FormWithResponseResponseDto>('form.get', { dto: FormWithResponseResponseDto })
    );
}

export function FormUserSubmitDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'submit form answers' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocGuard({ termPolicy: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: FormSubmitRequestDto }),
        DocResponse<FormResponseResponseDto>('form.submit', { dto: FormResponseResponseDto })
    );
}
