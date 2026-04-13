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
import { ITripDetail } from '@modules/trip/interfaces/trip.interface';
import { ITripInviteToken } from '@modules/trip/interfaces/trip-invite.interface';
import {
    Prisma,
    Trip,
    TripAttachmentType,
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
        updatedBy: string,
        inviteTokens?: ITripInviteToken[]
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
                ...(dto.itineraries !== undefined && {
                    itineraries: {
                        deleteMany: { tripId },
                        ...(dto.itineraries.length > 0 && {
                            create: this._buildItineraryCreateData(
                                dto.itineraries,
                                updatedBy
                            ),
                        }),
                    },
                }),
                ...(dto.calendarEvents !== undefined && {
                    calendarEvents: {
                        deleteMany: { tripId },
                        ...(dto.calendarEvents.length > 0 && {
                            create: this._buildCalendarEventCreateData(
                                dto.calendarEvents,
                                updatedBy
                            ),
                        }),
                    },
                }),
                ...(dto.medias !== undefined && {
                    medias: {
                        deleteMany: { tripId },
                        ...(dto.medias.length > 0 && {
                            create: this._buildMediaCreateData(
                                dto.medias,
                                tripId,
                                updatedBy
                            ),
                        }),
                    },
                }),
                ...(dto.attachments !== undefined && {
                    attachments: {
                        deleteMany: { tripId },
                        ...(dto.attachments.length > 0 && {
                            create: this._buildAttachmentCreateData(
                                dto.attachments,
                                tripId,
                                updatedBy
                            ),
                        }),
                    },
                }),
                ...(dto.contactIds !== undefined && {
                    contacts: {
                        deleteMany: { tripId },
                        ...(dto.contactIds.length > 0 && {
                            create: dto.contactIds.map(contactId => ({
                                contact: { connect: { id: contactId } },
                            })),
                        }),
                    },
                }),
                ...(inviteTokens &&
                    inviteTokens.length > 0 && {
                        invites: {
                            create: inviteTokens.map(
                                ({ email, tokenHash, expiresAt }) => ({
                                    createdBy: updatedBy,
                                    email,
                                    tokenHash,
                                    ...(expiresAt !== undefined && {
                                        expiresAt,
                                    }),
                                })
                            ),
                        },
                    }),
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
            where: { id: tripId, tenantId },
        });
    }

    async findOneById(tripId: string): Promise<Trip | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId },
        });
    }

    async findDetailByIdAndTenant(
        tripId: string,
        tenantId: string
    ): Promise<ITripDetail | null> {
        return this.databaseService.trip.findFirst({
            where: { id: tripId, tenantId },
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
            where: { id: tripId },
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
            where: { id: tripId, tenantId },
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
                ...status,
            },
        });
    }

    async findManyByTravelerOrPublished(
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
                OR: [
                    { status: TripStatus.published },
                    { travelers: { some: { userId } } },
                ],
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

    async cancel(tripId: string, updatedBy?: string): Promise<Trip> {
        return this.databaseService.trip.update({
            where: { id: tripId },
            data: {
                status: TripStatus.cancelled,
                cancelledAt: this.helperService.dateCreate(),
                ...(updatedBy && { updatedBy }),
            },
        });
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
