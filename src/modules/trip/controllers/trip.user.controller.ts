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
import { AuthJwtAccessProtected, AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import {
    Prisma,
    TripStatus,
} from '@generated/prisma-client';
import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { TripService } from '@modules/trip/services/trip.service';
import { TripInviteAcceptRequestDto } from '@modules/trip/dtos/request/trip-invite.accept.request.dto';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import {
    TRIP_TAG_USER,
    TripAvailableStatus,
    TripDefaultAvailableSearch,
    TripDefaultAvailableSort,
    TripDefaultPerPage,
} from '@modules/trip/constants/trip.constant';
import {
    TripInviteUserAcceptDoc,
    TripInviteUserListDoc,
} from '@modules/trip/docs/trip-invite.user.doc';
import {
    TripUserGetDoc,
    TripUserListDoc,
} from '@modules/trip/docs/trip.user.doc';

@ApiTags(TRIP_TAG_USER)
@Controller({ version: '1', path: '/user/trips' })
export class TripUserController {
    constructor(private readonly tripService: TripService) {}

    @TripInviteUserListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('invite.list')
    @Get('/invites')
    async listInvites(
        @AuthJwtPayload('userId') userId: string,
        @AuthJwtPayload('email') email: string,
        @PaginationOffsetQuery({
            defaultPerPage: TripDefaultPerPage,
            availableOrderBy: ['createdAt', 'updatedAt', 'expiresAt'],
        })
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripInviteSelect,
            Prisma.TripInviteWhereInput
        >
    ): Promise<IResponsePagingReturn<TripInviteListItemResponseDto>> {
        return this.tripService.getUserInviteList(userId, email, pagination);
    }

    @TripInviteUserAcceptDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('invite.accept')
    @HttpCode(HttpStatus.OK)
    @Post('/invites/accept')
    async acceptInvite(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: TripInviteAcceptRequestDto
    ): Promise<IResponseReturn<void>> {
        return this.tripService.acceptInvite(body.token, userId);
    }

    @TripUserListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ResponsePaging('trip.list')
    @Get('/')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @PaginationOffsetQuery({
            availableSearch: TripDefaultAvailableSearch,
            availableOrderBy: TripDefaultAvailableSort,
            defaultPerPage: TripDefaultPerPage,
        })
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        @PaginationQueryFilterInEnum<TripStatus>('status', TripAvailableStatus)
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        return this.tripService.getUserTripList(userId, pagination, status);
    }

    @TripUserGetDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @Response('trip.get')
    @Get('/:idTrip')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        return this.tripService.getTripForUser(tripId, userId);
    }
}
