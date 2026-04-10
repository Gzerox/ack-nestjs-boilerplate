import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { HelperService } from '@common/helper/services/helper.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import { TripAttachmentCreateRequestDto } from '@modules/trip/dtos/request/trip-attachment.create.request.dto';
import { TripMediaCreateRequestDto } from '@modules/trip/dtos/request/trip-media.create.request.dto';
import { ITripDetail } from '@modules/trip/interfaces/trip.interface';
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

    async create(data: Prisma.TripCreateInput): Promise<Trip> {
        return this.databaseService.trip.create({ data });
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

    buildTripMediaCreateData(
        medias: TripMediaCreateRequestDto[],
        createdBy: string,
        tripId: string
    ): Prisma.TripMediaCreateWithoutTripInput[] {
        return medias.map(media => ({
            createdBy,
            kind: media.kind ?? TripMediaKind.OTHER,
            caption: media.caption ?? null,
            ...(media.calendarEventId && {
                calendarEvent: {
                    connect: { id: media.calendarEventId },
                },
            }),
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
        }));
    }

    buildTripAttachmentCreateData(
        attachments: TripAttachmentCreateRequestDto[],
        createdBy: string,
        tripId: string
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
}
