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
    UploadedFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { FileUploadSingle } from '@common/file/decorators/file.decorator';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { IFile } from '@common/file/interfaces/file.interface';
import { FileExtensionPipe } from '@common/file/pipes/file.extension.pipe';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestTimeout } from '@common/request/decorators/request.decorator';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
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
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { TripTravelerListItemResponseDto } from '@modules/trip/dtos/response/trip-traveler.list-item.response.dto';
import { TripTravelerDetailResponseDto } from '@modules/trip/dtos/response/trip-traveler.detail.response.dto';
import {
    TRIP_TAG_SHARED,
    TripAvailableStatus,
    TripDefaultAvailableSearch,
    TripDefaultAvailableSort,
    TripDefaultPerPage,
} from '@modules/trip/constants/trip.constant';
import {
    TripSharedArchiveDoc,
    TripSharedCancelDoc,
    TripSharedCreateDraftDoc,
    TripSharedGetDoc,
    TripSharedListDoc,
    TripSharedPublishDoc,
    TripSharedRevokeInviteDoc,
    TripSharedUnpublishDoc,
    TripSharedUpdateDraftDoc,
    TripSharedUploadCoverImageDoc,
    TripSharedUploadIconDoc,
} from '@modules/trip/docs/trip.shared.doc';
import {
    TripTravelerSharedGetDoc,
    TripTravelerSharedListDoc,
} from '@modules/trip/docs/trip-traveler.shared.doc';
import { TripTravelerService } from '@modules/trip/services/trip-traveler.service';
import { DatabaseUtil } from '@common/database/utils/database.util';

@ApiTags(TRIP_TAG_SHARED)
@Controller({ version: '1', path: '/trips' })
export class TripSharedController {
    constructor(
        private readonly tripService: TripService,
        private readonly databaseUtil: DatabaseUtil,
        private readonly tripTravelerService: TripTravelerService
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
        const tenantId = this.databaseUtil.createId();
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripUpdateDraftRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateDraft(tripId, body, tenantId, userId);
    }

    @TripSharedUploadIconDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @FileUploadSingle()
    @RequestTimeout('1m')
    @Response('trip.uploadIcon')
    @HttpCode(HttpStatus.OK)
    @Put('/:idTrip/icon')
    async uploadIcon(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @UploadedFile(
            RequestRequiredPipe,
            FileExtensionPipe([
                EnumFileExtensionImage.jpeg,
                EnumFileExtensionImage.png,
                EnumFileExtensionImage.jpg,
            ])
        )
        file: IFile
    ): Promise<IResponseReturn<TripFileAssetResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.uploadIcon(tripId, file, tenantId);
    }

    @TripSharedUploadCoverImageDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @FileUploadSingle()
    @RequestTimeout('1m')
    @Response('trip.uploadCoverImage')
    @HttpCode(HttpStatus.OK)
    @Put('/:idTrip/cover-image')
    async uploadCoverImage(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @UploadedFile(
            RequestRequiredPipe,
            FileExtensionPipe([
                EnumFileExtensionImage.jpeg,
                EnumFileExtensionImage.png,
                EnumFileExtensionImage.jpg,
            ])
        )
        file: IFile
    ): Promise<IResponseReturn<TripFileAssetResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.uploadCoverImage(tripId, file, tenantId);
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string
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
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.getTrip(tripId, tenantId);
    }

    @TripSharedRevokeInviteDoc()
    @ActivityLog(EnumActivityLogAction.adminTripRevokeInvite)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('invite.revoke')
    @HttpCode(HttpStatus.OK)
    @Patch('/:idTrip/invites/:idInvite/revoke')
    async revokeInvite(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @Param('idInvite', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        inviteId: string
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.revokeInvite(
            tripId,
            inviteId,
            tenantId,
            userId
        );
    }

    @TripTravelerSharedListDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip.tripTraveler.list')
    @Get('/:idTrip/travelers')
    async listTravelers(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripTravelerSelect,
            Prisma.TripTravelerWhereInput
        >
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
    async getTraveler(
        @Param('idTrip', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        tripId: string,
        @Param('idTraveler', RequestIsValidObjectIdPipe, RequestRequiredPipe)
        travelerId: string
    ): Promise<IResponseReturn<TripTravelerDetailResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripTravelerService.getOne(tripId, travelerId, tenantId);
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
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >,
        @PaginationQueryFilterInEnum<TripStatus>('status', TripAvailableStatus)
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.getTripList(pagination, tenantId, status);
    }
}
