import { applyDecorators } from '@nestjs/common';
import { Doc, DocAuth, DocResponse, DocResponsePaging } from '@common/doc/decorators/doc.decorator';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';

export function TripTravelerSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip traveler list' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<TripTravelerListItemResponseDto>('trip.tripTraveler.list', {
            dto: TripTravelerListItemResponseDto,
        })
    );
}

export function TripTravelerSharedGetDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get trip traveler detail' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponse<TripTravelerDetailResponseDto>('trip.tripTraveler.get', {
            dto: TripTravelerDetailResponseDto,
        })
    );
}
