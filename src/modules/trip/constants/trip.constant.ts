import { TripStatus } from '@generated/prisma-client';

export const TRIP_TAG_SHARED = 'modules.shared.trip';
export const TRIP_TAG_USER = 'modules.user.trip';

export const TripDefaultAvailableSearch = ['title'];
export const TripDefaultAvailableSort = ['createdAt', 'startDate', 'endDate', 'title'];
export const TripDefaultSort = 'createdAt';
export const TripDefaultPerPage = 20;
export const TripAvailableStatus = Object.values(TripStatus);
