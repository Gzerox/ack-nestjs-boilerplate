import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { EnumAwsStatusCodeError } from '@common/aws/enums/aws.status-code.enum';
import { AwsS3Service } from '@common/aws/services/aws.s3.service';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { IFile } from '@common/file/interfaces/file.interface';
import { FileService } from '@common/file/services/file.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { HelperService } from '@common/helper/services/helper.service';
import { ITripService } from '@modules/trip/interfaces/trip.service.interface';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import {
    createTripAssetKey,
    generateUniqueSlug,
} from '@modules/trip/utils/trip.util';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { Prisma, Trip, TripCalendarEvent, TripStatus } from '@generated/prisma-client';

type TripAssetField = 'icon' | 'coverImage';

@Injectable()
export class TripService implements ITripService {
    private readonly logger = new Logger(TripService.name);

    constructor(
        private readonly tripRepository: TripRepository,
        private readonly tripTravelerRepository: TripTravelerRepository,
        private readonly helperService: HelperService,
        private readonly awsS3Service: AwsS3Service,
        private readonly fileService: FileService
    ) {}

    async createDraft(
        dto: TripCreateDraftRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripCreateDraftResponseDto>> {
        const slug = await generateUniqueSlug(dto.title, this.tripRepository, this.helperService);

        const trip = await this.tripRepository.create({
            slug,
            tenantId,
            createdBy,
            title: dto.title,
            subtitle: dto.subtitle ?? null,
            description: dto.description ?? null,
            icon: dto.icon ?? undefined,
            coverImage: dto.coverImage ?? undefined,
            startDate: dto.startDate,
            endDate: dto.endDate,
            timezone: dto.timezone ?? null,
            status: TripStatus.draft,
            ...(dto.calendarEvents?.length && {
                calendarEvents: {
                    create: dto.calendarEvents.map(e => ({
                        createdBy,
                        title: e.title,
                        category: e.category,
                        startsAt: e.startsAt ?? null,
                        endsAt: e.endsAt ?? null,
                        location: e.location ?? null,
                        description: e.description ?? null,
                    })),
                },
            }),
        });

        return {
            data: { id: trip.id, slug: trip.slug, status: trip.status } as TripCreateDraftResponseDto,
            metadataActivityLog: { tripId: trip.id },
        };
    }

    async updateDraft(
        tripId: string,
        dto: TripUpdateDraftRequestDto,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const existing = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!existing) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (existing.updatedAt.toISOString() !== new Date(dto.updatedAt).toISOString()) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.publishConflict,
                message: 'trip.error.publishConflict',
                data: { currentUpdatedAt: existing.updatedAt.toISOString() },
            });
        }

        if (existing.status !== TripStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.notDraft,
                message: 'trip.error.notDraft',
            });
        }

        const updateData: Prisma.TripUpdateInput = {
            title: dto.title,
            subtitle: dto.subtitle ?? undefined,
            description: dto.description ?? undefined,
            icon: dto.icon ?? undefined,
            coverImage: dto.coverImage ?? undefined,
            startDate: dto.startDate,
            endDate: dto.endDate,
            timezone: dto.timezone ?? undefined,
        };

        if (dto.calendarEvents !== undefined) {
            updateData.calendarEvents = {
                deleteMany: { tripId },
                ...(dto.calendarEvents.length > 0 && {
                    create: dto.calendarEvents.map(e => ({
                        createdBy: updatedBy,
                        title: e.title,
                        category: e.category,
                        startsAt: e.startsAt ?? null,
                        endsAt: e.endsAt ?? null,
                        location: e.location ?? null,
                        description: e.description ?? null,
                    })),
                }),
            };
        }

        await this.tripRepository.update(tripId, updateData);

        const updated = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!updated) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }
        return { data: this.mapToResponseDto(updated) };
    }

    async uploadIcon(
        tripId: string,
        file: IFile,
        tenantId: string
    ): Promise<IResponseReturn<TripFileAssetResponseDto>> {
        return this.uploadAsset(tripId, file, tenantId, 'icon');
    }

    async uploadCoverImage(
        tripId: string,
        file: IFile,
        tenantId: string
    ): Promise<IResponseReturn<TripFileAssetResponseDto>> {
        return this.uploadAsset(tripId, file, tenantId, 'coverImage');
    }

    async publish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (trip.status === TripStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.alreadyPublished,
                message: 'trip.error.alreadyPublished',
            });
        }

        if (trip.status !== TripStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.invalidTransition,
                message: 'trip.error.invalidTransition',
            });
        }

        await this.tripRepository.publish(tripId, updatedBy);
        const withEvents = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        return {
            data: this.mapToResponseDto(withEvents!),
            metadataActivityLog: { tripId: withEvents!.id },
        };
    }

    async unpublish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (trip.status !== TripStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.notPublished,
                message: 'trip.error.notPublished',
            });
        }

        await this.tripRepository.unpublish(tripId, updatedBy);
        const withEvents = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        return {
            data: this.mapToResponseDto(withEvents!),
            metadataActivityLog: { tripId: withEvents!.id },
        };
    }

    async cancel(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (trip.status === TripStatus.cancelled) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.alreadyCancelled,
                message: 'trip.error.alreadyCancelled',
            });
        }

        if (trip.status === TripStatus.archived) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.alreadyArchived,
                message: 'trip.error.alreadyArchived',
            });
        }

        await this.tripRepository.cancel(tripId, updatedBy);

        return { data: undefined, metadataActivityLog: { tripId } };
    }

    async archive(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (trip.status === TripStatus.archived) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.alreadyArchived,
                message: 'trip.error.alreadyArchived',
            });
        }

        if (trip.status !== TripStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.notPublished,
                message: 'trip.error.notPublished',
            });
        }

        await this.tripRepository.archive(tripId, updatedBy);

        return { data: undefined, metadataActivityLog: { tripId } };
    }

    async getTrip(
        tripId: string,
        tenantId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }
        return { data: this.mapToResponseDto(trip) };
    }

    async getTripList(
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        tenantId: string,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        const result = await this.tripRepository.findManyByTenant(pagination, tenantId, status);

        return {
            ...result,
            data: result.data.map(t => this.mapToListItemDto(t)),
        };
    }

    async getTripForUser(tripId: string, userId: string): Promise<IResponseReturn<TripResponseDto>> {
        // TODO: We should invoke tripTravelerRepository and load `trip` relationship.
        //  in this way we can simplify this service method, and invoke the repository only 1 time.
        //  Then we could should perform if(!traveler.trip){ throw NotFound }
        const trip = await this.tripRepository.findOneById(tripId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        const isTraveler = await this.tripTravelerRepository.existsByTripAndUser(tripId, userId);
        if (!isTraveler && trip.status !== TripStatus.published && trip.createdBy !== userId) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        return { data: this.mapToResponseDto(trip) };
    }

    async getUserTripList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<Prisma.TripSelect, Prisma.TripWhereInput>,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        const result = await this.tripRepository.findManyByTravelerOrPublished(
            userId,
            pagination,
            status
        );

        return {
            ...result,
            data: result.data.map(t => this.mapToListItemDto(t)),
        };
    }

    private mapToListItemDto(trip: Trip): TripListItemResponseDto {
        return {
            id: trip.id,
            slug: trip.slug,
            title: trip.title,
            subtitle: trip.subtitle,
            icon: trip.icon ?? null,
            coverImage: trip.coverImage ?? null,
            startDate: trip.startDate,
            endDate: trip.endDate,
            timezone: trip.timezone,
            status: trip.status,
            createdAt: trip.createdAt,
            updatedAt: trip.updatedAt,
        } as TripListItemResponseDto;
    }

    private mapToResponseDto(trip: Trip & { calendarEvents?: TripCalendarEvent[] }): TripResponseDto {
        return {
            ...this.mapToListItemDto(trip),
            description: trip.description,
            publishedAt: trip.publishedAt,
            cancelledAt: trip.cancelledAt,
            archivedAt: trip.archivedAt,
            calendarEvents: (trip.calendarEvents ?? []).map(e => ({
                id: e.id,
                title: e.title,
                category: e.category,
                startsAt: e.startsAt,
                endsAt: e.endsAt,
                location: e.location,
                description: e.description,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            })),
        } as TripResponseDto;
    }

    private async uploadAsset(
        tripId: string,
        file: IFile,
        tenantId: string,
        field: TripAssetField
    ): Promise<IResponseReturn<TripFileAssetResponseDto>> {
        const trip = await this.tripRepository.findOneByIdAndTenant(
            tripId,
            tenantId
        );

        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (trip.status !== TripStatus.draft) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.notDraft,
                message: 'trip.error.notDraft',
            });
        }

        const previousAsset = trip[field];
        const extension = this.fileService.extractExtensionFromFilename(
            file.originalname
        ) as EnumFileExtensionImage;
        const key = createTripAssetKey(
            trip.id,
            field,
            extension,
            this.fileService
        );
        const aws = await this.awsS3Service.putItem({
            key,
            size: file.size,
            file: file.buffer,
        });

        if (!aws) {
            throw new ServiceUnavailableException({
                statusCode: EnumAwsStatusCodeError.serviceUnavailable,
                message: 'aws.error.serviceUnavailable',
            });
        }

        try {
            const updateData: Prisma.TripUpdateInput =
                field === 'icon' ? { icon: aws } : { coverImage: aws };

            await this.tripRepository.update(trip.id, updateData);
        } catch (err: unknown) {
            await this.deleteAssetBestEffort(
                aws.key,
                `cleanup uploaded trip ${field} after failed database update`
            );

            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }

        if (previousAsset?.key && previousAsset.key !== aws.key) {
            await this.deleteAssetBestEffort(
                previousAsset.key,
                `cleanup previous trip ${field}`
            );
        }

        return {
            data: aws as TripFileAssetResponseDto,
        };
    }

    private async deleteAssetBestEffort(
        key: string,
        context: string
    ): Promise<void> {
        try {
            await this.awsS3Service.deleteItem(key);
        } catch (error: unknown) {
            this.logger.warn({ error, key }, `Failed to ${context}`);
        }
    }

}
