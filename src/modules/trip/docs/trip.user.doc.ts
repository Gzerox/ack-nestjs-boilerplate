import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';

export function TripUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get user trip list' }),
        DocAuth({ jwtAccessToken: true }),
        DocResponsePaging<TripListItemResponseDto>('trip.list', { dto: TripListItemResponseDto })
    );
}

export function TripUserGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get user trip detail' }),
        DocAuth({ jwtAccessToken: true }),
        DocResponse<TripResponseDto>('trip.get', { dto: TripResponseDto, httpStatus: HttpStatus.OK })
    );
}
