import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthJwtAccessProtected, AuthJwtPayload } from '@modules/auth/decorators/auth.jwt.decorator';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import { Response, ResponsePaging } from '@common/response/decorators/response.decorator';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import { ActivityLog } from '@modules/activity-log/decorators/activity-log.decorator';
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import {
    EnumActivityLogAction,
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
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { FormCreateDraftRequestDto } from '@modules/form/dtos/request/form-create-draft.request.dto';
import { FormCreateDraftResponseDto } from '@modules/form/dtos/response/form-create-draft.response.dto';
import { FormService } from '@modules/form/services/form.service';
import {
    TRIP_TAG_SHARED,
    TripAvailableStatus,
    TripDefaultAvailableSearch,
    TripDefaultAvailableSort,
    TripDefaultPerPage,
    TripDefaultSort,
} from '@modules/trip/constants/trip.constant';
import {
    TripSharedArchiveDoc,
    TripSharedCancelDoc,
    TripSharedCreateDraftDoc,
    TripSharedGetDoc,
    TripSharedListDoc,
    TripSharedPublishDoc,
    TripSharedUnpublishDoc,
    TripSharedUpdateDraftDoc,
} from '@modules/trip/docs/trip.shared.doc';

@ApiTags(TRIP_TAG_SHARED)
@Controller({ version: '1', path: '/trips' })
export class TripSharedController {
    constructor(
        private readonly tripService: TripService,
        private readonly formService: FormService
    ) {}

    @TripSharedCreateDraftDoc()
    @ActivityLog(EnumActivityLogAction.adminTripCreate)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.createDraft')
    @HttpCode(HttpStatus.CREATED)
    @Post('/')
    async createDraft(
        @AuthJwtPayload('userId') userId: string,
        @Body() body: TripCreateDraftRequestDto
    ): Promise<IResponseReturn<TripCreateDraftResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.createDraft(body, tenantId, userId);
    }

    @TripSharedUpdateDraftDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.update')
    @Put('/:idTrip')
    async updateDraft(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string,
        @Body() body: TripUpdateDraftRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateDraft(tripId, body, tenantId, userId);
    }

    @TripSharedPublishDoc()
    @ActivityLog(EnumActivityLogAction.adminTripPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.publish')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/publish')
    async publish(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.publish(tripId, tenantId, userId);
    }

    @TripSharedUnpublishDoc()
    @ActivityLog(EnumActivityLogAction.adminTripPublish)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.unpublish')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/unpublish')
    async unpublish(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.unpublish(tripId, tenantId, userId);
    }

    @TripSharedCancelDoc()
    @ActivityLog(EnumActivityLogAction.adminTripCancel)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.cancel')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/cancel')
    async cancel(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.cancel(tripId, tenantId, userId);
    }

    @TripSharedArchiveDoc()
    @ActivityLog(EnumActivityLogAction.adminTripArchive)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.archive')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/archive')
    async archive(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.archive(tripId, tenantId, userId);
    }

    @TripSharedGetDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.get')
    @Get('/:idTrip')
    async get(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe) tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.getTrip(tripId, tenantId);
    }

    @TripSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip.list')
    @Get('/')
    async list(
        @PaginationOffsetQuery({
            availableSearch: TripDefaultAvailableSearch,
            availableOrderBy: TripDefaultAvailableSort,
            defaultPerPage: TripDefaultPerPage,
        })
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        @PaginationQueryFilterInEnum<TripStatus>('status', TripAvailableStatus)
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.getTripList(pagination, tenantId, status);
    }

}
