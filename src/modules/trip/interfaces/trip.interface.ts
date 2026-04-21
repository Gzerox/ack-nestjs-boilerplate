import {
    TenantContact,
    Trip,
    TripAsset,
    TripAttachment,
    TripCalendarEvent,
    TripContact,
    TripInvite,
    TripMedia,
} from '@generated/prisma-client';

export interface ITripContactWithContact extends TripContact {
    contact: TenantContact;
}

export interface ITripMediaWithAsset extends TripMedia {
    asset: TripAsset;
}

export interface ITripAttachmentWithAsset extends TripAttachment {
    asset: TripAsset | null;
}

export interface ITripCalendarEventWithMedias extends TripCalendarEvent {
    medias: ITripMediaWithAsset[];
}

export interface ITripDetail extends Trip {
    calendarEvents: ITripCalendarEventWithMedias[];
    contacts: ITripContactWithContact[];
    invites: TripInvite[];
    medias: ITripMediaWithAsset[];
    attachments: ITripAttachmentWithAsset[];
}

export interface ITripPublicSummary {
    slug: string;
    title: string;
    subtitle: string | null;
    icon: TripAsset | null;
    coverImage: TripAsset | null;
    startDate: Date;
    endDate: Date;
    timezone: string | null;
}
