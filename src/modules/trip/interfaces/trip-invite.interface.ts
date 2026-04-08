import { Trip, TripInvite } from '@generated/prisma-client';

export type ITripInviteTripSummary = Pick<
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
>;

export interface ITripInviteWithTrip extends TripInvite {
    trip: ITripInviteTripSummary;
}
