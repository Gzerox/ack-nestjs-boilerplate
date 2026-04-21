import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    UploadedFile,
    UploadedFiles,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import {
    FileUploadMultiple,
    FileUploadSingle,
} from '@common/file/decorators/file.decorator';
import { FileSizeInBytes } from '@common/file/constants/file.constant';
import {
    EnumFileExtensionDocument,
    EnumFileExtensionImage,
    EnumFileExtensionVideo,
} from '@common/file/enums/file.enum';
import { IFile } from '@common/file/interfaces/file.interface';
import { FileExtensionPipe } from '@common/file/pipes/file.extension.pipe';
import { FileExtensionMultiplePipe } from '@common/file/pipes/file.extension-multiple.pipe';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestTimeout } from '@common/request/decorators/request.decorator';
import { RequestIsValidUuidPipe } from '@common/request/pipes/request.is-valid-uuid.pipe';
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
import { ParseJsonArrayPipe } from '@common/request/pipes/request.parse-json-array.pipe';
import { TripService } from '@modules/trip/services/trip.service';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripCalendarEventsUpdateRequestDto } from '@modules/trip/dtos/request/trip-calendar-events-update.request.dto';
import { TripContactsUpdateRequestDto } from '@modules/trip/dtos/request/trip-contacts-update.request.dto';
import { TripItinerariesUpdateRequestDto } from '@modules/trip/dtos/request/trip-itineraries-update.request.dto';
import { TripInvitesCreateRequestDto } from '@modules/trip/dtos/request/trip-invites-create.request.dto';
import { TripMediaBatchItemRequestDto } from '@modules/trip/dtos/request/trip-media-batch-item.request.dto';
import { TripAttachmentBatchItemRequestDto } from '@modules/trip/dtos/request/trip-attachment-batch-item.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripMediaResponseDto } from '@modules/trip/dtos/response/trip-media.response.dto';
import { TripAttachmentResponseDto } from '@modules/trip/dtos/response/trip-attachment.response.dto';
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
    TripSharedCreateDraftDoc,
    TripSharedCreateInvitesDoc,
    TripSharedDeleteDoc,
    TripSharedGetDoc,
    TripSharedListDoc,
    TripSharedPublishDoc,
    TripSharedRevokeInviteDoc,
    TripSharedUnpublishDoc,
    TripSharedUpdateCalendarEventsDoc,
    TripSharedUpdateContactsDoc,
    TripSharedUpdateDraftDoc,
    TripSharedUpdateItinerariesDoc,
    TripSharedUploadAttachmentBatchDoc,
    TripSharedUploadCoverImageDoc,
    TripSharedUploadIconDoc,
    TripSharedUploadMediaBatchDoc,
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripUpdateDraftRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateDraft(tripId, body, tenantId, userId);
    }

    @TripSharedUpdateCalendarEventsDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.updateCalendarEvents')
    @Put('/:idTrip/calendar-events')
    async updateCalendarEvents(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripCalendarEventsUpdateRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateCalendarEvents(
            tripId,
            tenantId,
            body,
            userId
        );
    }

    @TripSharedUpdateContactsDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.updateContacts')
    @Put('/:idTrip/contacts')
    async updateContacts(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripContactsUpdateRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateContacts(tripId, tenantId, body, userId);
    }

    @TripSharedUpdateItinerariesDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.updateItineraries')
    @Put('/:idTrip/itineraries')
    async updateItineraries(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripItinerariesUpdateRequestDto
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.updateItineraries(
            tripId,
            tenantId,
            body,
            userId
        );
    }

    @TripSharedCreateInvitesDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.createInvites')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/invites')
    async createInvites(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Body() body: TripInvitesCreateRequestDto
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.createInvites(tripId, tenantId, body, userId);
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.unpublish(tripId, tenantId, userId);
    }

    @TripSharedDeleteDoc()
    @ActivityLog(EnumActivityLogAction.adminTripDelete)
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip.delete')
    @HttpCode(HttpStatus.OK)
    @Delete('/:idTrip')
    async softDelete(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string
    ): Promise<IResponseReturn<void>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.softDelete(tripId, tenantId, userId);
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '69dbcb31a3da8ac66a1e5c42';
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Param('idInvite', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
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
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @Param('idTraveler', RequestIsValidUuidPipe, RequestRequiredPipe)
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

    @TripSharedUploadMediaBatchDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @FileUploadMultiple({
        field: 'files',
        maxFiles: 20,
        fileSize: FileSizeInBytes,
    })
    @RequestTimeout('2m')
    @Response('trip.uploadMedia')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/media')
    async uploadMediaBatch(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @UploadedFiles(
            FileExtensionMultiplePipe([
                EnumFileExtensionImage.jpeg,
                EnumFileExtensionImage.jpg,
                EnumFileExtensionImage.png,
                EnumFileExtensionVideo.mp4,
            ])
        )
        files: IFile[],
        @Body('data', new ParseJsonArrayPipe(TripMediaBatchItemRequestDto))
        metadata: TripMediaBatchItemRequestDto[]
    ): Promise<IResponseReturn<TripMediaResponseDto[]>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.uploadMediaBatch(
            tripId,
            files,
            metadata,
            tenantId,
            userId
        );
    }

    @TripSharedUploadAttachmentBatchDoc()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @FileUploadMultiple({
        field: 'files',
        maxFiles: 10,
        fileSize: FileSizeInBytes,
    })
    @RequestTimeout('2m')
    @Response('trip.uploadAttachments')
    @HttpCode(HttpStatus.CREATED)
    @Post('/:idTrip/attachments')
    async uploadAttachmentBatch(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestIsValidUuidPipe, RequestRequiredPipe)
        tripId: string,
        @UploadedFiles(
            FileExtensionMultiplePipe([EnumFileExtensionDocument.pdf])
        )
        files: IFile[],
        @Body('data', new ParseJsonArrayPipe(TripAttachmentBatchItemRequestDto))
        metadata: TripAttachmentBatchItemRequestDto[]
    ): Promise<IResponseReturn<TripAttachmentResponseDto[]>> {
        // TODO: Replace with actual tenantId from JWT payload when multi-tenancy is implemented
        const tenantId = '';
        return this.tripService.uploadAttachmentBatch(
            tripId,
            files,
            metadata,
            tenantId,
            userId
        );
    }
}
