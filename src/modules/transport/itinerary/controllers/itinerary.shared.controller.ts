import {
    Response,
} from '@common/response/decorators/response.decorator';
import {
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
import { RequestIsValidUuidPipe } from '@common/request/pipes/request.is-valid-uuid.pipe';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { ApiTags } from '@nestjs/swagger';
import {
    ItinerarySharedCreateDoc,
    ItinerarySharedGetDoc,
} from '@modules/transport/itinerary/docs/itinerary.shared.doc';
import { CreateItineraryRequestDto } from '@modules/transport/itinerary/dtos/request/create-itinerary.request.dto';
import { ItineraryWithSegmentsResponseDto } from '@modules/transport/itinerary/dtos/response/itinerary-with-segments.response.dto';
import { ItineraryService } from '@modules/transport/itinerary/services/itinerary.service';

@ApiTags('modules.shared.itinerary')
@Controller({
    path: 'itineraries',
    version: '1',
})
export class ItinerarySharedController {
    constructor(private readonly itineraryService: ItineraryService) {}

    @ItinerarySharedGetDoc()
    @Response('itinerary.get')
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get(':itineraryId')
    async get(
        @Param('itineraryId', RequestRequiredPipe, RequestIsValidUuidPipe)
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
