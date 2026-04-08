import { TripTraveler } from '@generated/prisma-client';

export interface ITripTravelerUser {
    id: string;
    name: string | null;
    username: string;
    email: string;
}

export interface ITripTravelerWithUser extends TripTraveler {
    user: ITripTravelerUser;
}
