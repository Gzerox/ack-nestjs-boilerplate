import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { IResponsePagingReturn, IResponseReturn } from '@common/response/interfaces/response.interface';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { HelperService } from '@common/helper/services/helper.service';
import { ITripService } from '@modules/trip/interfaces/trip.service.interface';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import { generateUniqueSlug } from '@modules/trip/utils/trip.util';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { Prisma, Trip, TripCalendarEvent, TripStatus } from '@generated/prisma-client';

@Injectable()
export class TripService implements ITripService {
    private readonly logger = new Logger(TripService.name);

    constructor(
        private readonly tripRepository: TripRepository,
        private readonly helperService: HelperService
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
        const existing = await this.tripRepository.existByIdAndTenant(tripId, tenantId);
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

        const fullTrip = await this.tripRepository.findOneByIdAndTenant(tripId, tenantId);
        if (fullTrip!.status !== TripStatus.draft) {
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
        return { data: this.mapToResponseDto(updated!) };
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
        const trip = await this.tripRepository.findOneById(tripId);
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        // TODO: When TripTraveler is implemented, verify user is part of the trip
        // For now, only published trips are accessible to users, or trips they created
        if (trip.status !== TripStatus.published && trip.createdBy !== userId) {
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
        // TODO: When TripTraveler is implemented, filter by trips where user is a TripTraveler or has pending TripInvite
        // For now, return published trips or trips created by the user
        const result = await this.tripRepository.findManyByUserOrPublished(
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

}
