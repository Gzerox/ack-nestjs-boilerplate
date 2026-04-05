import {
    Airport,
    TransportFlightSegment,
    TransportItinerary,
} from '@generated/prisma-client';

export interface ITransportFlightSegment {
    flightNumber: string;
    airline: string | null;
    departAirportId: string;
    arriveAirportId: string;
    departAt: Date;
    arriveAt: Date;
    bookingRef: string | null;
    notes: string | null;
}

export interface ITransportFlightSegmentWithAirports extends TransportFlightSegment {
    departAirport: Airport;
    arriveAirport: Airport;
}

export interface ITransportItineraryWithSegments extends TransportItinerary {
    segments: ITransportFlightSegmentWithAirports[];
}
