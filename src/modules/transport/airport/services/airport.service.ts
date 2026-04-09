import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { IAirportService } from '@modules/transport/airport/interfaces/airport.service.interface';
import { AirportRepository } from '@modules/transport/airport/repositories/airport.repository';
import { AirportUtil } from '@modules/transport/airport/utils/airport.util';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';

@Injectable()
export class AirportService implements IAirportService {
    constructor(
        private readonly airportRepository: AirportRepository,
        private readonly airportUtil: AirportUtil
    ) {}

    async getList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.AirportSelect,
            Prisma.AirportWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<AirportResponseDto>> {
        // TODO: We don't need to select the whole entity,
        //  we should pickup only required field requested by controller
        const { data, ...others } =
            await this.airportRepository.findWithPaginationOffset(
                pagination,
                status
            );
        const airports: AirportResponseDto[] = this.airportUtil.mapList(data);

        return {
            data: airports,
            ...others,
        };
    }

    async search(
        search: string,
        limit: number
    ): Promise<IResponseReturn<AirportResponseDto[]>> {
        const data = await this.airportRepository.search(search, limit);
        const airports: AirportResponseDto[] = this.airportUtil.mapList(data);

        return { data: airports };
    }
}
