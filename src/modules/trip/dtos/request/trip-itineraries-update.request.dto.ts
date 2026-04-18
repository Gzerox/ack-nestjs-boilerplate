import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TripItineraryCreateRequestDto } from '@modules/trip/dtos/request/trip-itinerary.create.request.dto';

export class TripItinerariesUpdateRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TripItineraryCreateRequestDto)
    itineraries: TripItineraryCreateRequestDto[];
}
