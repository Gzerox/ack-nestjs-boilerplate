import { EnumFlightDirection, TripEventCategory } from '@generated/prisma-client';

export interface TripSeedCalendarEvent {
    title: string;
    category: TripEventCategory;
    startsAt?: string;
    endsAt?: string;
    location?: string;
    description?: string;
}

export interface TripSeedItinerarySegment {
    flightNumber: string;
    airline?: string;
    departIata: string;
    arriveIata: string;
    departAt?: string;
    arriveAt?: string;
    bookingRef?: string;
    notes?: string;
}

export interface TripSeedItinerary {
    name: string;
    direction: EnumFlightDirection;
    segments: TripSeedItinerarySegment[];
}

export interface TripSeedRecord {
    slug: string;
    title: string;
    subtitle?: string;
    description?: string;
    startDate: string;
    endDate: string;
    timezone?: string;
    /**
     * Contact emails to look up from TenantContact.
     * Contacts are matched by email at seed time — run the tenant-contact seeder first.
     */
    contactEmails?: string[];
    calendarEvents?: TripSeedCalendarEvent[];
    itineraries?: TripSeedItinerary[];
}

const tripData: TripSeedRecord[] = [
    {
        slug: 'seed-default-trip',
        title: 'Default Seed Trip',
        subtitle: 'A sample trip created by the seeder',
        description: 'This trip is created automatically during database seeding.',
        startDate: '2026-06-15',
        endDate: '2026-06-30',
        timezone: 'Europe/Rome',
        contactEmails: ['guest@example.com'],
        calendarEvents: [
            {
                title: 'Arrival Day',
                category: TripEventCategory.arrival,
                startsAt: '2026-06-15T10:00:00',
                endsAt: '2026-06-15T12:00:00',
                location: 'CRV Airport',
                description: 'Guests arrive at Crotone airport.',
            },
            {
                title: 'Welcome Dinner',
                category: TripEventCategory.meal,
                startsAt: '2026-06-15T20:00:00',
                endsAt: '2026-06-15T23:00:00',
                location: 'Villa Rosso',
                description: 'Welcome dinner for all guests.',
            },
            {
                title: 'Day Trip - Sila National Park',
                category: TripEventCategory.activity,
                startsAt: '2026-06-17T09:00:00',
                endsAt: '2026-06-17T18:00:00',
                location: 'Sila National Park, Calabria',
            },
            {
                title: 'Transfer to Venue',
                category: TripEventCategory.transfer,
                startsAt: '2026-06-15T12:30:00',
                endsAt: '2026-06-15T14:00:00',
                location: 'From CRV Airport to Villa',
            },
            {
                title: 'Departure Day',
                category: TripEventCategory.departure,
                startsAt: '2026-06-30T08:00:00',
                endsAt: '2026-06-30T10:00:00',
                location: 'CRV Airport',
            },
        ],
        itineraries: [
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
        ],
    },
];

export const migrationTripData: TripSeedRecord[] = tripData;
