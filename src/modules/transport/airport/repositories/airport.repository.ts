import { DatabaseService } from '@common/database/services/database.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { Injectable } from '@nestjs/common';
import { Airport, Prisma } from '@generated/prisma-client';
import { EnumAirportStatus } from '@modules/transport/airport/enums/airport.enum';

@Injectable()
export class AirportRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async findWithPaginationOffset(
        {
            where,
            ...params
        }: IPaginationQueryOffsetParams<
            Prisma.AirportSelect,
            Prisma.AirportWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<Airport>> {
        return this.paginationService.offset<
            Airport,
            Prisma.AirportSelect,
            Prisma.AirportWhereInput
        >(this.databaseService.airport, {
            ...params,
            where: {
                ...where,
                ...status,
            },
        });
    }

    async findOneById(id: string): Promise<Airport | null> {
        return this.databaseService.airport.findUnique({
            where: { id },
        });
    }

    async create(data: Prisma.AirportCreateInput): Promise<Airport> {
        return this.databaseService.airport.create({ data });
    }

    async update(
        id: string,
        data: Prisma.AirportUpdateInput
    ): Promise<Airport> {
        return this.databaseService.airport.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<Airport> {
        return this.databaseService.airport.delete({
            where: { id },
        });
    }

    async search(
        search: string,
        limit: number
    ): Promise<
        Pick<Airport, 'id' | 'iataCode' | 'name' | 'city' | 'country' | 'timezone'>[]
    > {
        return this.databaseService.airport.findMany({
            where: {
                status: EnumAirportStatus.active,
                OR: search
                    ? [
                          { iataCode: { contains: search, mode: 'insensitive' } },
                          { icaoCode: { contains: search, mode: 'insensitive' } },
                          { name: { contains: search, mode: 'insensitive' } },
                          { city: { contains: search, mode: 'insensitive' } },
                          { country: { contains: search, mode: 'insensitive' } },
                      ]
                    : undefined,
            },
            select: {
                id: true,
                iataCode: true,
                name: true,
                city: true,
                country: true,
                timezone: true,
            },
            take: limit,
            orderBy: { iataCode: 'asc' },
        });
    }
}
