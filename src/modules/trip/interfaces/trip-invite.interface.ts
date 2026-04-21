import {
    Trip,
    TripAsset,
    TripInvite,
    TripInviteStatus,
} from '@generated/prisma-client';

export interface ITripInviteTripSummary extends Omit<
    Pick<
        Trip,
        | 'id'
        | 'slug'
        | 'title'
        | 'subtitle'
        | 'icon'
        | 'coverImage'
        | 'startDate'
        | 'endDate'
        | 'timezone'
        | 'status'
        | 'createdAt'
        | 'updatedAt'
    >,
    'icon' | 'coverImage'
> {
    icon: TripAsset | null;
    coverImage: TripAsset | null;
}

export interface ITripInviteWithTrip extends TripInvite {
    trip: ITripInviteTripSummary;
}

export interface ITripInviteToken {
    email: string;
    tokenHash: string;
    rawToken: string;
    expiresAt?: Date;
}

export interface ITripInviteIdentify {
    id: string;
    tripId: string;
    email: string;
    userId: string | null;
    status: TripInviteStatus;
    expiresAt: Date | null;
}
