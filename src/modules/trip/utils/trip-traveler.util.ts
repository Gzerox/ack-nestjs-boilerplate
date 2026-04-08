import { ITripTravelerWithUser } from '@modules/trip/interfaces/trip-traveler.interface';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';

export function mapTravelerToListItemDto(traveler: ITripTravelerWithUser): TripTravelerListItemResponseDto {
    return {
        id: traveler.id,
        tripId: traveler.tripId,
        userId: traveler.userId,
        groupId: traveler.groupId ?? null,
        createdBy: traveler.createdBy,
        createdAt: traveler.createdAt,
        updatedAt: traveler.updatedAt,
        user: {
            id: traveler.user.id,
            name: traveler.user.name,
            username: traveler.user.username,
            email: traveler.user.email,
        },
    };
}

export function mapTravelerToDetailDto(traveler: ITripTravelerWithUser): TripTravelerDetailResponseDto {
    return mapTravelerToListItemDto(traveler);
}
