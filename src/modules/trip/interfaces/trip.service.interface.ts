import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IFile } from '@common/file/interfaces/file.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { Prisma } from '@generated/prisma-client';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
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

    cancel(
        tripId: string,
        tenantId: string,
        updatedBy: string
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
}
