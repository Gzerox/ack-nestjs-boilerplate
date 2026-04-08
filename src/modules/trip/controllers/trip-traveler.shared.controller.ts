import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthJwtAccessProtected } from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { EnumActivityLogAction, Prisma } from '@generated/prisma-client';
import { PaginationOffsetQuery } from '@common/pagination/decorators/pagination.decorator';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { TripTravelerService } from '@modules/trip/services/trip-traveler.service';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';
import {
    TripTravelerSharedGetDoc,
    TripTravelerSharedListDoc,
} from '@modules/trip/docs/trip-traveler.shared.doc';

@ApiTags('modules.shared.trip.traveler')
@Controller({ version: '1', path: '/trips' })
export class TripTravelerSharedController {
    constructor(private readonly tripTravelerService: TripTravelerService) {}

    @TripTravelerSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip.tripTraveler.list')
    @Get('/:idTrip/travelers')
    async list(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<Prisma.TripTravelerSelect, Prisma.TripTravelerWhereInput>
    ): Promise<IResponsePagingReturn<TripTravelerListItemResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripTravelerService.getList(tripId, tenantId, pagination);
    }

    @TripTravelerSharedGetDoc()
    @ActivityLog(EnumActivityLogAction.adminTripTravelerGet)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.tripTraveler.get')
    @Get('/:idTrip/travelers/:idTraveler')
    async get(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
        @Param('idTraveler', RequestIsValidObjectIdPipe, RequestRequiredPipe) travelerId: string
    ): Promise<IResponseReturn<TripTravelerDetailResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripTravelerService.getOne(tripId, travelerId, tenantId);
    }
}
