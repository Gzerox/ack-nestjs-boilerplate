import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripCalendarEventResponseDto } from '@modules/trip/dtos/response/trip-calendar-event.response.dto';
import { TripInviteResponseDto } from '@modules/trip/dtos/response/trip-invite.response.dto';

export class TripResponseDto extends TripListItemResponseDto {
    @ApiProperty({ required: false })
    description: string | null;

    @ApiProperty({ example: faker.date.recent(), required: false })
    publishedAt: Date | null;

    @ApiProperty({ example: faker.date.recent(), required: false })
    cancelledAt: Date | null;

    @ApiProperty({ example: faker.date.recent(), required: false })
    archivedAt: Date | null;

    @ApiProperty({ type: () => TripCalendarEventResponseDto, isArray: true, required: true })
    @Type(() => TripCalendarEventResponseDto)
    calendarEvents: TripCalendarEventResponseDto[];

    @ApiProperty({ type: () => TripInviteResponseDto, isArray: true, required: true })
    @Type(() => TripInviteResponseDto)
    invites: TripInviteResponseDto[];
}
