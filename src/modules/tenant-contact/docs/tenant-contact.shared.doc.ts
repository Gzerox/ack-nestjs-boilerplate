import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';
import { TenantContactCreateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.create.request.dto';
import { TenantContactUpdateRequestDto } from '@modules/tenant-contact/dtos/request/tenant-contact.update.request.dto';

const TenantContactDocParamsIdContact = [
    {
        name: 'idContact',
        required: true,
        description: 'Contact identifier',
        type: String,
    },
];

export function TenantContactSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get tenant contact list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TenantContactResponseDto>('tenantContact.list', {
            dto: TenantContactResponseDto,
        })
    );
}

export function TenantContactSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get tenant contact detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TenantContactResponseDto>('tenantContact.get', {
            dto: TenantContactResponseDto,
        })
    );
}

export function TenantContactSharedCreateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create tenant contact' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TenantContactCreateRequestDto }),
        DocResponse<TenantContactResponseDto>('tenantContact.create', {
            dto: TenantContactResponseDto,
            httpStatus: HttpStatus.CREATED,
        })
    );
}

export function TenantContactSharedUpdateDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update tenant contact' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({
            bodyType: EnumDocRequestBodyType.json,
            dto: TenantContactUpdateRequestDto,
            params: TenantContactDocParamsIdContact,
        }),
        DocResponse<TenantContactResponseDto>('tenantContact.update', {
            dto: TenantContactResponseDto,
        })
    );
}

export function TenantContactSharedDeleteDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'soft delete tenant contact' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('tenantContact.delete')
    );
}
