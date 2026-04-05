import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { AuthJwtAccessProtected } from '@modules/auth/decorators/auth.jwt.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { AirportDefaultAvailableSearch } from '@modules/transport/airport/constants/airport.list.constant';
import { AirportUserListDoc, AirportUserSearchDoc } from '@modules/transport/airport/docs/airport.user.doc';
import { AirportSearchRequestDto } from '@modules/transport/airport/dtos/request/airport.search.request.dto';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { AirportSearchResponseDto } from '@modules/transport/airport/dtos/response/airport.search.response.dto';
import { EnumAirportStatus } from '@modules/transport/airport/enums/airport.enum';
import { AirportService } from '@modules/transport/airport/services/airport.service';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@generated/prisma-client';

@ApiTags('modules.user.airport')
@Controller({
    version: '1',
    path: '/airports',
})
export class AirportUserController {
    constructor(private readonly airportService: AirportService) {}

    @AirportUserListDoc()
    @ResponsePaging('airport.list')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('')
    async list(
        @PaginationOffsetQuery({
            availableSearch: AirportDefaultAvailableSearch,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.AirportSelect,
            Prisma.AirportWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumAirportStatus>(
            'status',
            Object.values(EnumAirportStatus)
        )
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<AirportResponseDto>> {
        return this.airportService.getList(pagination, status);
    }

    @AirportUserSearchDoc()
    @Response('airport.search')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/search')
    async search(
        @Query() { search, limit }: AirportSearchRequestDto
    ): Promise<IResponseReturn<AirportSearchResponseDto[]>> {
        return this.airportService.search(search, limit);
    }
}
