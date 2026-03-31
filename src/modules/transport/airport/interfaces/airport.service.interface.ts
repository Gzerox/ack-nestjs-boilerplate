import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { Prisma } from '@generated/prisma-client';

export interface IAirportService {
    getList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.AirportSelect,
            Prisma.AirportWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<AirportResponseDto>>;
}
