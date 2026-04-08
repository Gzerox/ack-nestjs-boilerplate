import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { Response } from '@common/response/decorators/response.decorator';
import { IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { TripService } from '@modules/trip/services/trip.service';
import { TripInviteAcceptRequestDto } from '@modules/trip/dtos/request/trip-invite.accept.request.dto';
import { TripInviteUserAcceptDoc } from '@modules/trip/docs/trip-invite.user.doc';
import { TRIP_TAG_USER } from '@modules/trip/constants/trip.constant';

@ApiTags(TRIP_TAG_USER)
@Controller({ version: '1', path: '/trips' })
export class TripInviteUserController {
    constructor(private readonly tripService: TripService) {}

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
