import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ITripTravelerService } from '@modules/trip/interfaces/trip-traveler.service.interface';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';
import { mapTravelerToDetailDto, mapTravelerToListItemDto } from '@modules/trip/utils/trip-traveler.util';

@Injectable()
export class TripTravelerService implements ITripTravelerService {
    constructor(
        private readonly tripTravelerRepository: TripTravelerRepository,
        private readonly tripRepository: TripRepository
    ) {}

    async getList(
        tripId: string,
        tenantId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripTravelerSelect, Prisma.TripTravelerWhereInput>
    ): Promise<IResponsePagingReturn<TripTravelerListItemResponseDto>> {
        const trip = await this.tripRepository.existByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        const result = await this.tripTravelerRepository.findManyByTrip(tripId, pagination);
        return {
            ...result,
            data: result.data.map(t => mapTravelerToListItemDto(t)),
        };
    }

    async getOne(
        tripId: string,
        travelerId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripTravelerDetailResponseDto>> {
        const trip = await this.tripRepository.existByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        const traveler = await this.tripTravelerRepository.findOneByTripAndId(tripId, travelerId);
        if (!traveler) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.travelerNotFound,
                message: 'trip.error.travelerNotFound',
            });
        }

        return { data: mapTravelerToDetailDto(traveler) };
    }
}
