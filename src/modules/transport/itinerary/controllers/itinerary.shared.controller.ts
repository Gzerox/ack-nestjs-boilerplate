import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { AuthJwtAccessProtected, AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@generated/prisma-client';
import {
    ItinerarySharedCreateDoc,
    ItinerarySharedGetDoc,
    ItinerarySharedListDoc,
} from '../docs/itinerary.shared.doc';
import { CreateItineraryRequestDto } from '../dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '../dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '../dtos/response/itinerary-with-segments.response.dto';
import { EnumFlightDirection } from '../enums/itinerary.enum';
import { ItineraryDefaultAvailableSearch } from '../constants/itinerary.list.constant';
import { ItineraryService } from '../services/itinerary.service';

@ApiTags('modules.shared.itinerary')
@Controller({
    path: 'itineraries',
    version: '1',
})
export class ItinerarySharedController {
    constructor(private readonly itineraryService: ItineraryService) {}

    @ItinerarySharedListDoc()
    @ResponsePaging('itinerary.list')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('')
    async list(
        @PaginationOffsetQuery({ availableSearch: ItineraryDefaultAvailableSearch })
        pagination: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumFlightDirection>(
            'direction',
            Object.values(EnumFlightDirection),
        )
        direction?: Record<string, IPaginationIn>,
    ): Promise<IResponsePagingReturn<ItineraryResponseDto>> {
        return this.itineraryService.getListOffset(pagination, direction);
    }

    @ItinerarySharedGetDoc()
    @Response('itinerary.get')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get(':itineraryId')
    async get(
        @Param('itineraryId') itineraryId: string,
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        return this.itineraryService.getOne(itineraryId);
    }

    @ItinerarySharedCreateDoc()
    @Response('itinerary.create')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.CREATED)
    @Post('')
    async create(
        @AuthJwtPayload('userId') userId: string,
        @Body() dto: CreateItineraryRequestDto,
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        return this.itineraryService.create(dto, userId);
    }
}
