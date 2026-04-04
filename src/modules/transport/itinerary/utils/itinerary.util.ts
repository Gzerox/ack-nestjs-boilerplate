import { Injectable } from '@nestjs/common';
import { TransportFlightSegment, TransportItinerary } from '@generated/prisma-client';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import {
    ItineraryWithSegmentsResponseDto,
    SegmentResponseDto,
} from '../dtos/response/itinerary-with-segments.response.dto';

@Injectable()
export class ItineraryUtil {
    mapList(data: TransportItinerary[]): ItineraryResponseDto[] {
        return data.map((itinerary) => ({
            id: itinerary.id,
            name: itinerary.name,
            direction: itinerary.direction,
            createdAt: itinerary.createdAt,
            updatedAt: itinerary.updatedAt,
        }));
    }

    mapOneWithSegments(
        itinerary: TransportItinerary & {
            segments: (TransportFlightSegment & {
                departAirport: any;
                arriveAirport: any;
            })[];
        },
    ): ItineraryWithSegmentsResponseDto {
        return {
            id: itinerary.id,
            name: itinerary.name,
            direction: itinerary.direction,
            createdAt: itinerary.createdAt,
            updatedAt: itinerary.updatedAt,
            segments: itinerary.segments.map((segment) => this.mapSegment(segment)),
        };
    }

    private mapSegment(
        segment: TransportFlightSegment & { departAirport: any; arriveAirport: any },
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
            departAirport: segment.departAirport,
            arriveAirport: segment.arriveAirport,
            createdAt: segment.createdAt,
            updatedAt: segment.updatedAt,
        };
    }
}
