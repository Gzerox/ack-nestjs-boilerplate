import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';

export function TripSharedCreateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'create trip draft' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripCreateDraftRequestDto }),
        DocResponse<TripCreateDraftResponseDto>('trip.createDraft', {
            dto: TripCreateDraftResponseDto,
            httpStatus: HttpStatus.CREATED,
        })
    );
}

export function TripSharedUpdateDraftDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'update draft trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripUpdateDraftRequestDto }),
        DocResponse<TripResponseDto>('trip.update', { dto: TripResponseDto })
    );
}

export function TripSharedPublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'publish trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.publish', { dto: TripResponseDto })
    );
}

export function TripSharedUnpublishDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'unpublish trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.unpublish', { dto: TripResponseDto })
    );
}

export function TripSharedCancelDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'cancel trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip.cancel')
    );
}

export function TripSharedArchiveDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'archive trip' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse('trip.archive')
    );
}

export function TripSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.get', { dto: TripResponseDto })
    );
}

export function TripSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TripListItemResponseDto>('trip.list', { dto: TripListItemResponseDto })
    );
}
