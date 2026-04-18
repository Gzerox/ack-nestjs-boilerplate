import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IFile } from '@common/file/interfaces/file.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
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
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripPublicResponseDto } from '@modules/trip/dtos/response/trip-public.response.dto';
import { TripMediaResponseDto } from '@modules/trip/dtos/response/trip-media.response.dto';
import { TripAttachmentResponseDto } from '@modules/trip/dtos/response/trip-attachment.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';

export interface ITripService {
    createDraft(
        dto: TripCreateDraftRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripCreateDraftResponseDto>>;

    updateDraft(
        tripId: string,
        dto: TripUpdateDraftRequestDto,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    uploadIcon(
        tripId: string,
        file: IFile,
        tenantId: string
    ): Promise<IResponseReturn<TripFileAssetResponseDto>>;

    uploadCoverImage(
        tripId: string,
        file: IFile,
        tenantId: string
    ): Promise<IResponseReturn<TripFileAssetResponseDto>>;

    publish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    unpublish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    softDelete(
        tripId: string,
        tenantId: string,
        deletedBy: string
    ): Promise<IResponseReturn<void>>;

    updateCalendarEvents(
        tripId: string,
        tenantId: string,
        dto: TripCalendarEventsUpdateRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    updateContacts(
        tripId: string,
        tenantId: string,
        dto: TripContactsUpdateRequestDto
    ): Promise<IResponseReturn<TripResponseDto>>;

    updateItineraries(
        tripId: string,
        tenantId: string,
        dto: TripItinerariesUpdateRequestDto,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    createInvites(
        tripId: string,
        tenantId: string,
        dto: TripInvitesCreateRequestDto,
        createdBy: string
    ): Promise<IResponseReturn<void>>;

    archive(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>>;

    getTrip(
        tripId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripResponseDto>>;

    getTripList(
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        tenantId: string,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>>;

    getTripForUser(tripId: string, userId: string): Promise<IResponseReturn<TripResponseDto>>;

    getUserTripList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>>;

    getUserInviteList(
        userId: string,
        email: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripInviteSelect, Prisma.TripInviteWhereInput>
    ): Promise<IResponsePagingReturn<TripInviteListItemResponseDto>>;

    getTripBySlug(
        tripSlug: string
    ): Promise<IResponseReturn<TripPublicResponseDto>>;

    acceptInvite(
        rawToken: string,
        userId: string
    ): Promise<IResponseReturn<void>>;

    revokeInvite(
        tripId: string,
        inviteId: string,
        tenantId: string,
        revokedBy: string
    ): Promise<IResponseReturn<void>>;

    uploadMediaBatch(
        tripId: string,
        files: IFile[],
        metadata: TripMediaBatchItemRequestDto[],
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripMediaResponseDto[]>>;

    uploadAttachmentBatch(
        tripId: string,
        files: IFile[],
        metadata: TripAttachmentBatchItemRequestDto[],
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripAttachmentResponseDto[]>>;
}
