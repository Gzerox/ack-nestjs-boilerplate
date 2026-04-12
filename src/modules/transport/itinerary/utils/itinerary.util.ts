import { Injectable } from '@nestjs/common';
import { TransportItinerary } from '@generated/prisma-client';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { EnumAirportStatus } from '@modules/transport/airport/enums/airport.enum';
import { ItineraryResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary.response.dto';
import {
    ItineraryWithSegmentsResponseDto,
    SegmentResponseDto,
} from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';
import {
    ITransportFlightSegmentWithAirports,
    ITransportItineraryWithSegments,
} from '@modules/transport/itinerary/interfaces/itinerary.interface';

@Injectable()
export class ItineraryUtil {
    mapList(data: TransportItinerary[]): ItineraryResponseDto[] {
        return data.map(itinerary => ({
            id: itinerary.id,
            tripId: itinerary.tripId,
            name: itinerary.name,
            direction: itinerary.direction,
            createdAt: itinerary.createdAt,
            updatedAt: itinerary.updatedAt,
        }));
    }

    mapOneWithSegments(
        itinerary: ITransportItineraryWithSegments
    ): ItineraryWithSegmentsResponseDto {
        return {
            id: itinerary.id,
            tripId: itinerary.tripId,
            name: itinerary.name,
            direction: itinerary.direction,
            createdAt: itinerary.createdAt,
            updatedAt: itinerary.updatedAt,
            segments: itinerary.segments.map(segment =>
                this.mapSegment(segment)
            ),
        };
    }

    private mapSegment(
        segment: ITransportFlightSegmentWithAirports
    ): SegmentResponseDto {
        return {
            id: segment.id,
            itineraryId: segment.itineraryId,
            airline: segment.airline || null,
            flightNumber: segment.flightNumber,
            departAt: segment.departAt,
            arriveAt: segment.arriveAt,
            bookingRef: segment.bookingRef || null,
            notes: segment.notes || null,
            departAirport: this.mapAirport(segment.departAirport),
            arriveAirport: this.mapAirport(segment.arriveAirport),
            createdAt: segment.createdAt,
            updatedAt: segment.updatedAt,
        };
    }

    private mapAirport(
        airport: ITransportFlightSegmentWithAirports['departAirport']
    ): AirportResponseDto {
        return {
            id: airport.id,
            iataCode: airport.iataCode,
            icaoCode: airport.icaoCode,
            name: airport.name,
            shortName: airport.shortName ?? undefined,
            city: airport.city,
            country: airport.country,
            countryCode: airport.countryCode,
            continent: airport.continent,
            continentCode: airport.continentCode ?? undefined,
            timezone: airport.timezone,
            currencyCode: airport.currencyCode ?? undefined,
            status: airport.status as EnumAirportStatus,
            createdAt: airport.createdAt,
            createdBy: airport.createdBy ?? undefined,
            updatedAt: airport.updatedAt,
            updatedBy: airport.updatedBy ?? undefined,
        };
    }
}
