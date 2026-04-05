import { EnumFlightDirection } from '@generated/prisma-client';

export interface ItinerarySeedSegment {
    flightNumber: string;
    airline?: string;
    departIata: string;
    arriveIata: string;
    departAt: string;
    arriveAt: string;
    bookingRef?: string;
    notes?: string;
}

export interface ItinerarySeedRecord {
    name: string;
    direction: EnumFlightDirection;
    segments: ItinerarySeedSegment[];
}

const itineraryData: ItinerarySeedRecord[] = [
    {
        name: 'Sample Guest - Outbound',
        direction: EnumFlightDirection.outbound,
        segments: [
            {
                flightNumber: 'AZ1234',
                airline: 'ITA Airways',
                departIata: 'BRI',
                arriveIata: 'FOG',
                departAt: '2026-06-15T08:00:00',
                arriveAt: '2026-06-15T09:00:00',
                bookingRef: 'ABC123',
                notes: 'Short domestic leg',
            },
            {
                flightNumber: 'AZ5678',
                airline: 'ITA Airways',
                departIata: 'FOG',
                arriveIata: 'CRV',
                departAt: '2026-06-15T11:00:00',
                arriveAt: '2026-06-15T12:30:00',
                bookingRef: 'ABC123',
            },
        ],
    },
    {
        name: 'Sample Guest - Return',
        direction: EnumFlightDirection.return,
        segments: [
            {
                flightNumber: 'AZ9012',
                airline: 'ITA Airways',
                departIata: 'CRV',
                arriveIata: 'BRI',
                departAt: '2026-06-30T14:00:00',
                arriveAt: '2026-06-30T15:15:00',
                bookingRef: 'XYZ789',
            },
        ],
    },
];

export const migrationItineraryData: ItinerarySeedRecord[] = itineraryData;
