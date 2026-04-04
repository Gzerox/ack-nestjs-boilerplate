import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { ItineraryResponseDto } from './itinerary.response.dto';

export class SegmentResponseDto {
    id: string;
    itineraryId: string;
    airline: string | null;
    flightNumber: string;
    departAt: Date | null;
    arriveAt: Date | null;
    bookingRef: string | null;
    notes: string | null;
    departAirport: AirportResponseDto;
    arriveAirport: AirportResponseDto;
    createdAt: Date;
    updatedAt: Date;
}

export class ItineraryWithSegmentsResponseDto extends ItineraryResponseDto {
    segments: SegmentResponseDto[];
}
