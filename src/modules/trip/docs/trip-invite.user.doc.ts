import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { EnumDocRequestBodyType } from '@common/doc/enums/doc.enum';
import { TripInviteAcceptRequestDto } from '@modules/trip/dtos/request/trip-invite.accept.request.dto';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';

export function TripInviteUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get user trip invite list' }),
        DocAuth({ jwtAccessToken: true }),
        DocResponsePaging<TripInviteListItemResponseDto>('invite.list', {
            dto: TripInviteListItemResponseDto,
        })
    );
}

export function TripInviteUserAcceptDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'accept trip invite' }),
        DocAuth({ jwtAccessToken: true }),
        DocRequest({ bodyType: EnumDocRequestBodyType.json, dto: TripInviteAcceptRequestDto }),
        DocResponse('invite.accept', { httpStatus: HttpStatus.OK })
    );
}
