import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { TripService } from '@modules/trip/services/trip.service';
import { TripInviteAcceptRequestDto } from '@modules/trip/dtos/request/trip-invite.accept.request.dto';
import {
    TripInviteUserAcceptDoc,
    TripInviteUserListDoc,
} from '@modules/trip/docs/trip-invite.user.doc';
import {
    TRIP_TAG_USER,
    TripDefaultPerPage,
} from '@modules/trip/constants/trip.constant';
import { PaginationOffsetQuery } from '@common/pagination/decorators/pagination.decorator';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { Prisma } from '@generated/prisma-client';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';

@ApiTags(TRIP_TAG_USER)
@Controller({ version: '1', path: '/user/trips' })
export class TripInviteUserController {
    constructor(private readonly tripService: TripService) {}

    @TripInviteUserListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('invite.list')
    @Get('/invites')
    async list(
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
    async accept(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: TripInviteAcceptRequestDto
    ): Promise<IResponseReturn<void>> {
        return this.tripService.acceptInvite(body.token, userId);
    }
}
