import {
    TenantContact,
    Trip,
    TripCalendarEvent,
    TripContact,
    TripInvite,
} from '@generated/prisma-client';

export interface ITripContactWithContact extends TripContact {
    contact: TenantContact;
}

export interface ITripDetail extends Trip {
    calendarEvents: TripCalendarEvent[];
    contacts: ITripContactWithContact[];
    invites: TripInvite[];
}
