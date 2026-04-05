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
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
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
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@generated/prisma-client';
import {
    ItinerarySharedCreateDoc,
    ItinerarySharedGetDoc,
    ItinerarySharedListDoc,
} from '@modules/transport/itinerary/docs/itinerary.shared.doc';
import { CreateItineraryRequestDto } from '@modules/transport/itinerary/dtos/request/create-itinerary.request.dto';
import { ItineraryResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary.response.dto';
import { ItineraryWithSegmentsResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';
import { EnumFlightDirection } from '@modules/transport/itinerary/enums/itinerary.enum';
import {
    ItineraryDefaultAvailableSearch,
    ItineraryDefaultPerPage,
} from '@modules/transport/itinerary/constants/itinerary.list.constant';
import { ItineraryService } from '@modules/transport/itinerary/services/itinerary.service';

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
        @PaginationOffsetQuery({
            availableSearch: ItineraryDefaultAvailableSearch,
            defaultPerPage: ItineraryDefaultPerPage,
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.TransportItinerarySelect,
            Prisma.TransportItineraryWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumFlightDirection>(
            'direction',
            Object.values(EnumFlightDirection)
        )
        direction?: Record<string, IPaginationIn>
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
        @Param('itineraryId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        itineraryId: string
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
        @Body() dto: CreateItineraryRequestDto
    ): Promise<IResponseReturn<ItineraryWithSegmentsResponseDto>> {
        return this.itineraryService.create(dto, userId);
    }
}
