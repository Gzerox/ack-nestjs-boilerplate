import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';

export interface IItineraryService {
    getListOffset(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        direction?: Record<string, IPaginationIn>,
    ): Promise<IResponsePagingReturn<ItineraryResponseDto>>;

    getOne(id: string): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;

    create(
        dto: CreateItineraryRequestDto,
        createdBy: string,
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>>;
}
