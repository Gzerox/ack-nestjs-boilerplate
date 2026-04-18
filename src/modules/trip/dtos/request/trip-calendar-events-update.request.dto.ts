import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripCalendarEventCreateRequestDto } from '@modules/trip/dtos/request/trip-calendar-event.create.request.dto';

export class TripCalendarEventsUpdateRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripCalendarEventCreateRequestDto)
    calendarEvents: TripCalendarEventCreateRequestDto[];
}
