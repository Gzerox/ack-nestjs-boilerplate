import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TripInviteResponseDto } from '@modules/trip/dtos/response/trip-invite.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';

export class TripInviteListItemResponseDto extends TripInviteResponseDto {
    @ApiProperty({ type: () => TripListItemResponseDto, required: true })
    @Type(() => TripListItemResponseDto)
    trip: TripListItemResponseDto;
}
