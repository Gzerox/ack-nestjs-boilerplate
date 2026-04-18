import {
    Controller,
    Get,
    Param,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { Response } from '@common/response/decorators/response.decorator';
import { IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import {
    TRIP_TAG_PUBLIC,
} from '@modules/trip/constants/trip.constant';
import { TripPublicResponseDto } from '@modules/trip/dtos/response/trip-public.response.dto';
import { TripPublicGetBySlugDoc } from '@modules/trip/docs/trip.public.doc';
import { TripService } from '@modules/trip/services/trip.service';

@ApiTags(TRIP_TAG_PUBLIC)
@Controller({ version: '1', path: '/trips' })
export class TripPublicController {
    constructor(private readonly tripService: TripService) {}

    @TripPublicGetBySlugDoc()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.get')
    @Get('/:tripSlug')
    async getBySlug(
        @Param('tripSlug', RequestRequiredPipe) tripSlug: string
    ): Promise<IResponseReturn<TripPublicResponseDto>> {
        return this.tripService.getTripBySlug(tripSlug);
    }
}
