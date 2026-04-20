import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperService } from '@common/helper/services/helper.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripAttachmentCreateRequestDto } from '@modules/trip/dtos/request/trip-attachment.create.request.dto';
import { TripMediaCreateRequestDto } from '@modules/trip/dtos/request/trip-media.create.request.dto';
import { TripCalendarEventCreateRequestDto } from '@modules/trip/dtos/request/trip-calendar-event.create.request.dto';
import { TripInviteCreateRequestDto } from '@modules/trip/dtos/request/trip-invite.create.request.dto';
import { TripItineraryCreateRequestDto } from '@modules/trip/dtos/request/trip-itinerary.create.request.dto';
import {
    ITripDetail,
    ITripPublicSummary,
} from '@modules/trip/interfaces/trip.interface';
import {
    Prisma,
    Trip,
    TripAttachmentType,
    TripInviteStatus,
    TripMediaKind,
    TripStatus,
} from '@generated/prisma-client';

@Injectable()
export class TripRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService,
        private readonly helperService: HelperService
    ) {}

    async createDraft(
        dto: TripCreateDraftRequestDto,
        tenantId: string,
        createdBy: string,
        slug: string,
        tripId: string
    ): Promise<Trip> {
        return this.databaseService.trip.create({
            data: {
                id: tripId,
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
                deletedAt: null,
                ...(dto.calendarEvents?.length && {
                    calendarEvents: {
                        create: this._buildCalendarEventCreateData(
                            dto.calendarEvents,
                            createdBy
                        ),
                    },
                }),
                ...(dto.invites?.length && {
                    invites: {
                        create: this._buildInviteCreateData(
                            dto.invites,
                            createdBy
                        ),
                    },
                }),
                ...(dto.medias?.length && {
                    medias: {
                        create: this._buildMediaCreateData(
                            dto.medias,
                            tripId,
                            createdBy
                        ),
                    },
                }),
                ...(dto.attachments?.length && {
                    attachments: {
                        create: this._buildAttachmentCreateData(
                            dto.attachments,
                            tripId,
                            createdBy
                        ),
                    },
                }),
                ...(dto.contactIds?.length && {
                    contacts: {
                        create: dto.contactIds.map(contactId => ({
                            contact: { connect: { id: contactId } },
                        })),
                    },
                }),
                ...(dto.itineraries?.length && {
                    itineraries: {
                        create: this._buildItineraryCreateData(
                            dto.itineraries,
                            createdBy
                        ),
                    },
                }),
            },
        });
    }

    async updateDraft(
        tripId: string,
        dto: TripUpdateDraftRequestDto,
        updatedBy: string
    ): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                title: dto.title,
                subtitle: dto.subtitle ?? undefined,
                description: dto.description ?? undefined,
                icon: dto.icon ?? undefined,
                coverImage: dto.coverImage ?? undefined,
                startDate: dto.startDate,
                endDate: dto.endDate,
                timezone: dto.timezone ?? undefined,
                updatedBy: updatedBy,
            },
        });
    }

    async updateCalendarEvents(
        tripId: string,
        events: TripCalendarEventCreateRequestDto[],
        updatedBy: string
    ): Promise<void> {
        await this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                calendarEvents: {
                    deleteMany: { tripId },
                    ...(events.length > 0 && {
                        create: this._buildCalendarEventCreateData(
                            events,
                            updatedBy
                        ),
                    }),
                },
            },
        });
    }

    async updateContacts(tripId: string, contactIds: string[]): Promise<void> {
        await this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                contacts: {
                    deleteMany: { tripId },
                    ...(contactIds.length > 0 && {
                        create: contactIds.map(contactId => ({
                            contact: {
                                connect: { id: contactId },
                            },
                        })),
                    }),
                },
            },
        });
    }

    async updateItineraries(
        tripId: string,
        itineraries: TripItineraryCreateRequestDto[],
        updatedBy: string
    ): Promise<void> {
        await this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                itineraries: {
                    deleteMany: { tripId },
                    ...(itineraries.length > 0 && {
                        create: this._buildItineraryCreateData(
                            itineraries,
                            updatedBy
                        ),
                    }),
                },
            },
        });
    }

    async update(tripId: string, data: Prisma.TripUpdateInput): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data,
        });
    }

    async findOneByIdAndTenant(
        tripId: string,
        tenantId: string
    ): Promise<Trip | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, tenantId, deletedAt: null },
        });
    }

    async findOneById(tripId: string): Promise<Trip | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, deletedAt: null },
        });
    }

    async findOneBySlug(slug: string): Promise<ITripPublicSummary | null> {
        return this.databaseService.trip.findFirst({
            where: {
                slug,
                status: TripStatus.published,
                deletedAt: null,
            },
            select: {
                slug: true,
                title: true,
                subtitle: true,
                icon: true,
                coverImage: true,
                startDate: true,
                endDate: true,
                timezone: true,
            },
        });
    }

    async findDetailByIdAndTenant(
        tripId: string,
        tenantId: string
    ): Promise<ITripDetail | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, tenantId, deletedAt: null },
            include: {
                calendarEvents: {
                    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        medias: {
                            include: {
                                asset: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
                invites: {
                    orderBy: { createdAt: 'asc' },
                },
                contacts: {
                    include: {
                        contact: true,
                    },
                },
                medias: {
                    include: {
                        asset: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
                attachments: {
                    include: {
                        asset: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }

    async findDetailById(tripId: string): Promise<ITripDetail | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, deletedAt: null },
            include: {
                calendarEvents: {
                    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
                    include: {
                        medias: {
                            include: {
                                asset: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                },
                invites: {
                    orderBy: { createdAt: 'asc' },
                },
                contacts: {
                    include: {
                        contact: true,
                    },
                },
                medias: {
                    include: {
                        asset: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
                attachments: {
                    include: {
                        asset: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }

    async existByIdAndTenant(
        tripId: string,
        tenantId: string
    ): Promise<{ id: string; updatedAt: Date } | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, tenantId, deletedAt: null },
            select: { id: true, updatedAt: true },
        });
    }

    async existsBySlug(slug: string): Promise<boolean> {
        const record = await this.databaseService.trip.findUnique({
            where: { slug },
            select: { id: true },
        });
        return record !== null;
    }

    async findManyByTenant(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >,
        tenantId: string,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<Trip>> {
        return this.paginationService.offset<
            Trip,
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >(this.databaseService.trip, {
            ...pagination,
            where: {
                ...pagination.where,
                tenantId,
                deletedAt: null,
                ...status,
            },
        });
    }

    async findManyByTravelerAndStatus(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<Trip>> {
        return this.paginationService.offset<
            Trip,
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >(this.databaseService.trip, {
            ...pagination,
            where: {
                ...pagination.where,
                deletedAt: null,
                status: TripStatus.published,
                travelers: { some: { userId } },
                ...status,
            },
        });
    }

    async publish(tripId: string, updatedBy?: string): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                status: TripStatus.published,
                publishedAt: this.helperService.dateCreate(),
                ...(updatedBy && { updatedBy }),
            },
        });
    }

    async softDeleteWithRevokeInvites(
        id: string,
        tenantId: string,
        deletedBy: string,
        now: Date
    ): Promise<void> {
        await this.databaseService.$transaction([
            this.databaseService.trip.update({
                where: { id, tenantId },
                data: { deletedAt: now, deletedBy },
            }),
            this.databaseService.tripInvite.updateMany({
                where: {
                    tripId: id,
                    status: {
                        in: [
                            TripInviteStatus.pending,
                            TripInviteStatus.invited,
                        ],
                    },
                },
                data: {
                    status: TripInviteStatus.revoked,
                    revokedAt: now,
                    revokedBy: deletedBy,
                },
            }),
        ]);
    }

    async archive(tripId: string, updatedBy?: string): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                status: TripStatus.archived,
                archivedAt: this.helperService.dateCreate(),
                ...(updatedBy && { updatedBy }),
            },
        });
    }

    async unpublish(tripId: string, updatedBy?: string): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                status: TripStatus.draft,
                publishedAt: null,
                ...(updatedBy && { updatedBy }),
            },
        });
    }

    private _buildCalendarEventCreateData(
        events: TripCalendarEventCreateRequestDto[],
        createdBy: string
    ): Prisma.TripCalendarEventCreateWithoutTripInput[] {
        return events.map(e => ({
            createdBy,
            title: e.title,
            category: e.category,
            startsAt: e.startsAt ?? null,
            endsAt: e.endsAt ?? null,
            location: e.location ?? null,
            description: e.description ?? null,
        }));
    }

    private _buildInviteCreateData(
        invites: TripInviteCreateRequestDto[],
        createdBy: string
    ): Prisma.TripInviteCreateWithoutTripInput[] {
        return invites.map(invite => {
            const tokenHash = this.helperService.sha256Hash(
                this.helperService.randomString(32)
            );

            return {
                createdBy,
                email: invite.email,
                tokenHash,
                status: TripInviteStatus.pending,
                expiresAt: invite.expiresAt ?? null,
            };
        });
    }

    private _buildMediaCreateData(
        medias: TripMediaCreateRequestDto[],
        tripId: string,
        createdBy: string
    ): Prisma.TripMediaCreateWithoutTripInput[] {
        return medias.map(media => ({
            createdBy,
            kind: media.kind ?? TripMediaKind.OTHER,
            caption: media.caption ?? null,
            calendarEventId: media.calendarEventId ?? undefined,
            ...(media.file && {
                asset: {
                    create: {
                        tripId,
                        bucket: media.file.bucket,
                        key: media.file.key,
                        cdnUrl: media.file.cdnUrl ?? null,
                        completedUrl: media.file.completedUrl,
                        mime: media.file.mime,
                        extension: media.file.extension,
                        access: media.file.access,
                        size: media.file.size,
                    },
                },
            }),
        }));
    }

    private _buildAttachmentCreateData(
        attachments: TripAttachmentCreateRequestDto[],
        tripId: string,
        createdBy: string
    ): Prisma.TripAttachmentCreateWithoutTripInput[] {
        return attachments.map(attachment => ({
            createdBy,
            title: attachment.title,
            type: attachment.type ?? TripAttachmentType.OTHER,
            contentMarkdown: attachment.contentMarkdown ?? null,
            displayName: attachment.displayName ?? null,
            required: attachment.required,
            ...(attachment.file && {
                asset: {
                    create: {
                        tripId,
                        bucket: attachment.file.bucket,
                        key: attachment.file.key,
                        cdnUrl: attachment.file.cdnUrl ?? null,
                        completedUrl: attachment.file.completedUrl,
                        mime: attachment.file.mime,
                        extension: attachment.file.extension,
                        access: attachment.file.access,
                        size: attachment.file.size,
                    },
                },
            }),
        }));
    }

    private _buildItineraryCreateData(
        itineraries: TripItineraryCreateRequestDto[],
        createdBy: string
    ): Prisma.TransportItineraryUncheckedCreateWithoutTripInput[] {
        return itineraries.map(itinerary => ({
            name: itinerary.name,
            direction: itinerary.direction,
            createdBy,
            segments: {
                create: itinerary.segments.map(seg => ({
                    flightNumber: seg.flightNumber,
                    airline: seg.airline ?? null,
                    departAirport: {
                        connect: { id: seg.departAirportId },
                    },
                    arriveAirport: {
                        connect: { id: seg.arriveAirportId },
                    },
                    departAt: seg.departAt,
                    arriveAt: seg.arriveAt,
                    bookingRef: seg.bookingRef ?? null,
                    notes: seg.notes ?? null,
                    createdBy,
                })),
            },
        }));
    }
}
