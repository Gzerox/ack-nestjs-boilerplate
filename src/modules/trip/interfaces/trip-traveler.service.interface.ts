import { Prisma } from '@generated/prisma-client';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';

export interface ITripTravelerService {
    getList(
        tripId: string,
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripTravelerSelect, Prisma.TripTravelerWhereInput>
    ): Promise<IResponsePagingReturn<TripTravelerListItemResponseDto>>;

    getOne(
        tripId: string,
        travelerId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripTravelerDetailResponseDto>>;
}
