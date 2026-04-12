import {
    EnumTripFormKind,
    EnumTripFormResponseStatus,
    EnumTripFormStatus,
} from '@generated/prisma-client';

export const TRIP_FORM_TAG_SHARED = 'modules.shared.trip-form';
export const TRIP_FORM_TAG_USER = 'modules.user.trip-form';

export const TripFormDefaultAvailableSearch = ['title', 'description'];
export const TripFormDefaultAvailableSort = [
    'createdAt',
    'publishedAt',
    'closesAt',
    'title',
];
export const TripFormDefaultSort = 'createdAt';
export const TripFormDefaultPerPage = 20;
export const TripFormAvailableStatus = Object.values(EnumTripFormStatus);
export const TripFormAvailableResponseStatus = Object.values(EnumTripFormResponseStatus);
export const TripFormAvailableKind = Object.values(EnumTripFormKind);
