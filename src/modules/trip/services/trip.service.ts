import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { EnumRequestStatusCodeError } from '@common/request/enums/request.status-code.enum';
import { EnumAwsStatusCodeError } from '@common/aws/enums/aws.status-code.enum';
import { AwsS3Service } from '@common/aws/services/aws.s3.service';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { IFile } from '@common/file/interfaces/file.interface';
import { FileService } from '@common/file/services/file.service';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { HelperService } from '@common/helper/services/helper.service';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { ITripService } from '@modules/trip/interfaces/trip.service.interface';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { TripTravelerRepository } from '@modules/trip/repositories/trip-traveler.repository';
import { TripInviteRepository } from '@modules/trip/repositories/trip-invite.repository';
import { TenantContactRepository } from '@modules/trip/repositories/tenant-contact.repository';
import { TripAssetRepository } from '@modules/trip/repositories/trip-asset.repository';
import { TripCalendarEventRepository } from '@modules/trip/repositories/trip-calendar-event.repository';
import { TripItineraryCreateRequestDto } from '@modules/trip/dtos/request/trip-itinerary.create.request.dto';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import { TripUtil } from '@modules/trip/utils/trip.util';
import { TripCreateDraftRequestDto } from '@modules/trip/dtos/request/trip.create-draft.request.dto';
import { TripUpdateDraftRequestDto } from '@modules/trip/dtos/request/trip.update-draft.request.dto';
import { TripInviteCreateRequestDto } from '@modules/trip/dtos/request/trip-invite.create.request.dto';
import { TripMediaBatchItemRequestDto } from '@modules/trip/dtos/request/trip-media-batch-item.request.dto';
import { TripAttachmentBatchItemRequestDto } from '@modules/trip/dtos/request/trip-attachment-batch-item.request.dto';
import { TripCreateDraftResponseDto } from '@modules/trip/dtos/response/trip.create-draft.response.dto';
import { TripFileAssetResponseDto } from '@modules/trip/dtos/response/trip-file-asset.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';
import { TripMediaResponseDto } from '@modules/trip/dtos/response/trip-media.response.dto';
import { TripAttachmentResponseDto } from '@modules/trip/dtos/response/trip-attachment.response.dto';
import {
    Prisma,
    Trip,
    TripInviteStatus,
    TripStatus,
} from '@generated/prisma-client';

type TripAssetField = 'icon' | 'coverImage';

@Injectable()
export class TripService implements ITripService {
    private readonly logger = new Logger(TripService.name);

    constructor(
        private readonly tripRepository: TripRepository,
        private readonly tripTravelerRepository: TripTravelerRepository,
        private readonly tripInviteRepository: TripInviteRepository,
        private readonly tenantContactRepository: TenantContactRepository,
        private readonly tripAssetRepository: TripAssetRepository,
        private readonly tripCalendarEventRepository: TripCalendarEventRepository,
        private readonly tripUtil: TripUtil,
        private readonly helperService: HelperService,
        private readonly awsS3Service: AwsS3Service,
        private readonly fileService: FileService,
        private readonly databaseUtil: DatabaseUtil
    ) {}

    async createDraft(
        dto: TripCreateDraftRequestDto,
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripCreateDraftResponseDto>> {
        await this.assertValidContactIds(dto.contactIds ?? [], tenantId);

        const slug = await this.tripUtil.generateUniqueSlug(
            dto.title,
            this.tripRepository
        );
        const tripId = this.databaseUtil.createId();

        let trip: Trip;
        try {
            trip = await this.tripRepository.create({
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
                ...(dto.invites?.length && {
                    invites: {
                        create: dto.invites.map(invite => {
                            // TODO: validate duplicate invite emails before persisting.
                            const tokenHash = this.helperService.sha256Hash(
                                this.helperService.randomString(32)
                            );

                            return {
                                createdBy,
                                email: invite.email,
                                tokenHash,
                                expiresAt: invite.expiresAt ?? null,
                            };
                        }),
                    },
                }),
                ...(dto.medias?.length && {
                    medias: {
                        create: this.tripRepository.buildTripMediaCreateData(
                            dto.medias,
                            createdBy,
                            tripId
                        ),
                    },
                }),
                ...(dto.attachments?.length && {
                    attachments: {
                        create:
                            this.tripRepository.buildTripAttachmentCreateData(
                                dto.attachments,
                                createdBy,
                                tripId
                            ),
                    },
                }),
                ...(dto.contactIds?.length && {
                    contacts: {
                        create: dto.contactIds.map(contactId => ({
                            contact: {
                                connect: { id: contactId },
                            },
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
            });
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip.createDraft',
                    tenantId,
                    tripId,
                },
                _error: error,
            });
        }

        return {
            data: {
                id: trip.id,
                slug: trip.slug,
                status: trip.status,
            },
            metadataActivityLog: { tripId: trip.id },
        };
    }

    async updateDraft(
        tripId: string,
        dto: TripUpdateDraftRequestDto,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const existing = await this.tripRepository.findOneByIdAndTenant(
            tripId,
            tenantId
        );
        if (!existing) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (
            existing.updatedAt.toISOString() !==
            new Date(dto.updatedAt).toISOString()
        ) {
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

        if (dto.contactIds !== undefined) {
            await this.assertValidContactIds(dto.contactIds, tenantId);
        }

        const inviteTokens = await this._prepareInviteTokens(dto.invites ?? []);

        // Validate that new invite emails do not conflict with existing invites
        if (inviteTokens.length) {
            for (const { email } of inviteTokens) {
                const exists =
                    await this.tripInviteRepository.existsByTripAndEmail(
                        tripId,
                        email
                    );
                if (exists) {
                    throw new ConflictException({
                        statusCode:
                            EnumTripStatusCodeError.inviteAlreadyAccepted,
                        message: 'trip.error.inviteAlreadyAccepted',
                        data: { email },
                    });
                }
            }
        }

        try {
            await this.tripRepository.update(tripId, {
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
                        //TODO: Bad - everytime we delete all entries and re-create them.
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
                        //TODO: Bad - everytime we delete all entries and re-create them.
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
                    },
                }),
                ...(dto.medias !== undefined && {
                    medias: {
                        //TODO: Bad - everytime we delete all entries and re-create them.
                        deleteMany: { tripId },
                        ...(dto.medias.length > 0 && {
                            create: this.tripRepository.buildTripMediaCreateData(
                                dto.medias,
                                updatedBy,
                                tripId
                            ),
                        }),
                    },
                }),
                ...(dto.attachments !== undefined && {
                    attachments: {
                        //TODO: Bad - everytime we delete all entries and re-create them.
                        deleteMany: { tripId },
                        ...(dto.attachments.length > 0 && {
                            create: this.tripRepository.buildTripAttachmentCreateData(
                                dto.attachments,
                                updatedBy,
                                tripId
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
                ...(inviteTokens.length > 0 && {
                    invites: {
                        create: inviteTokens.map(({ email, tokenHash, expiresAt }) => ({
                            createdBy: updatedBy,
                            email,
                            tokenHash,
                            ...(expiresAt !== undefined && { expiresAt }),
                        })),
                    },
                }),
            });
        } catch (error: unknown) {
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                data: {
                    operation: 'trip.updateDraft',
                    tenantId,
                    tripId,
                },
                _error: error,
            });
        }

        if (dto.medias !== undefined || dto.attachments !== undefined) {
            await this.tripAssetRepository.deleteOrphanByTrip(tripId);
        }

        const updated = await this.tripRepository.findDetailByIdAndTenant(
            tripId,
            tenantId
        );
        if (!updated) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }
        return { data: this.tripUtil.mapResponse(updated) };
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
        const withEvents = await this.tripRepository.findDetailByIdAndTenant(
            tripId,
            tenantId
        );
        return {
            data: this.tripUtil.mapResponse(withEvents!),
            metadataActivityLog: { tripId: withEvents!.id },
        };
    }

    async unpublish(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<TripResponseDto>> {
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

        if (trip.status !== TripStatus.published) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.notPublished,
                message: 'trip.error.notPublished',
            });
        }

        await this.tripRepository.unpublish(tripId, updatedBy);
        const withEvents = await this.tripRepository.findDetailByIdAndTenant(
            tripId,
            tenantId
        );
        return {
            data: this.tripUtil.mapResponse(withEvents!),
            metadataActivityLog: { tripId: withEvents!.id },
        };
    }

    async cancel(
        tripId: string,
        tenantId: string,
        updatedBy: string
    ): Promise<IResponseReturn<void>> {
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
        const trip = await this.tripRepository.findDetailByIdAndTenant(
            tripId,
            tenantId
        );
        if (!trip) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }
        return { data: this.tripUtil.mapResponse(trip) };
    }

    async getTripList(
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >,
        tenantId: string,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        const result = await this.tripRepository.findManyByTenant(
            pagination,
            tenantId,
            status
        );

        return {
            ...result,
            data: this.tripUtil.mapList(result.data),
        };
    }

    async getTripForUser(
        tripId: string,
        userId: string
    ): Promise<IResponseReturn<TripResponseDto>> {
        const [tripDetail, isTraveler] = await Promise.all([
            this.tripRepository.findDetailById(tripId),
            this.tripTravelerRepository.existsByTripAndUser(tripId, userId),
        ]);

        if (!tripDetail) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        if (
            !isTraveler ||
            tripDetail.status !== TripStatus.published
        ) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        return { data: this.tripUtil.mapResponse(tripDetail) };
    }

    async getUserTripList(
        userId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripSelect,
            Prisma.TripWhereInput
        >,
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripListItemResponseDto>> {
        const result = await this.tripRepository.findManyByTravelerOrPublished(
            userId,
            pagination,
            status
        );

        return {
            ...result,
            data: this.tripUtil.mapList(result.data),
        };
    }

    async getUserInviteList(
        userId: string,
        email: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripInviteSelect,
            Prisma.TripInviteWhereInput
        >
    ): Promise<IResponsePagingReturn<TripInviteListItemResponseDto>> {
        const result = await this.tripInviteRepository.findManyByUser(
            userId,
            email,
            pagination
        );

        return {
            ...result,
            data: this.tripUtil.mapInviteListItemList(result.data),
        };
    }

    async acceptInvite(
        rawToken: string,
        userId: string
    ): Promise<IResponseReturn<void>> {
        const tokenHash = this.helperService.sha256Hash(rawToken);
        const invite =
            await this.tripInviteRepository.findOneByTokenHash(tokenHash);

        if (!invite) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.inviteTokenInvalid,
                message: 'trip.error.inviteTokenInvalid',
            });
        }

        if (invite.status === TripInviteStatus.accepted) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.inviteAlreadyAccepted,
                message: 'trip.error.inviteAlreadyAccepted',
            });
        }

        if (invite.status === TripInviteStatus.revoked) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.inviteRevoked,
                message: 'trip.error.inviteRevoked',
            });
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.inviteExpired,
                message: 'trip.error.inviteExpired',
            });
        }

        const now = this.helperService.dateCreate();
        await this.tripInviteRepository.acceptWithTraveler(
            invite.id,
            userId,
            invite.tripId,
            now
        );

        return { data: undefined };
    }

    async revokeInvite(
        tripId: string,
        inviteId: string,
        tenantId: string,
        revokedBy: string
    ): Promise<IResponseReturn<void>> {
        const tripExists = await this.tripRepository.existByIdAndTenant(
            tripId,
            tenantId
        );
        if (!tripExists) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.notFound,
                message: 'trip.error.notFound',
            });
        }

        const invite = await this.tripInviteRepository.findOneByIdAndTrip(
            inviteId,
            tripId
        );
        if (!invite) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.inviteNotFound,
                message: 'trip.error.inviteNotFound',
            });
        }

        if (invite.status === TripInviteStatus.revoked) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.inviteRevoked,
                message: 'trip.error.inviteRevoked',
            });
        }

        const now = this.helperService.dateCreate();
        await this.tripInviteRepository.revoke(inviteId, revokedBy, now);

        return { data: undefined };
    }

    private _buildItineraryCreateData(
        itineraries: TripItineraryCreateRequestDto[],
        createdBy: string
    ): Prisma.TransportItineraryCreateWithoutTripInput[] {
        //TODO: We shall validate the airportId exists
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

    private async _prepareInviteTokens(
        inviteDtos: TripInviteCreateRequestDto[]
    ): Promise<
        Array<{
            email: string;
            tokenHash: string;
            rawToken: string;
            expiresAt?: Date;
        }>
    > {
        if (!inviteDtos.length) {
            return [];
        }

        const emails = inviteDtos.map(d => d.email);
        const unique = new Set(emails);
        if (unique.size !== emails.length) {
            throw new ConflictException({
                statusCode: EnumTripStatusCodeError.inviteAlreadyAccepted,
                message: 'trip.error.inviteAlreadyAccepted',
            });
        }

        return inviteDtos.map(d => {
            const rawToken = this.helperService.randomString(32);
            const tokenHash = this.helperService.sha256Hash(rawToken);
            return {
                email: d.email,
                tokenHash,
                rawToken,
                expiresAt: d.expiresAt,
            };
        });
    }

    private async assertValidContactIds(
        contactIds: string[],
        tenantId: string
    ): Promise<void> {
        if (!contactIds.length) {
            return;
        }

        const uniqueContactIds = [...new Set(contactIds)];
        const contacts =
            await this.tenantContactRepository.findManyActiveByIdsAndTenant(
                uniqueContactIds,
                tenantId
            );

        if (contacts.length !== uniqueContactIds.length) {
            throw new NotFoundException({
                statusCode: EnumTripStatusCodeError.contactNotFound,
                message: 'trip.error.contactNotFound',
            });
        }
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
        const key = this.tripUtil.createTripAssetKey(trip.id, field, extension);
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

    async uploadMediaBatch(
        tripId: string,
        files: IFile[],
        metadata: TripMediaBatchItemRequestDto[],
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripMediaResponseDto[]>> {
        if (files.length !== metadata.length) {
            throw new UnprocessableEntityException({
                statusCode: EnumRequestStatusCodeError.validation,
                message: 'request.error.validation',
            });
        }

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

        const calendarEventIds = [
            ...new Set(
                metadata
                    .map(m => m.calendarEventId)
                    .filter((id): id is string => !!id)
            ),
        ];
        if (calendarEventIds.length > 0) {
            const valid =
                await this.tripCalendarEventRepository.existsByIdsAndTrip(
                    calendarEventIds,
                    tripId
                );
            if (!valid) {
                throw new NotFoundException({
                    statusCode:
                        EnumTripStatusCodeError.mediaCalendarEventInvalid,
                    message: 'trip.error.mediaCalendarEventInvalid',
                });
            }
        }

        const uploadedKeys: string[] = [];
        const batchItems = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = this.fileService.extractExtensionFromFilename(
                file.originalname
            );
            const key = this.tripUtil.createTripAssetKey(
                tripId,
                'media',
                extension
            );
            const aws = await this.awsS3Service.putItem({
                key,
                size: file.size,
                file: file.buffer,
            });

            if (!aws) {
                await this.deleteAssetsBestEffort(uploadedKeys);
                throw new ServiceUnavailableException({
                    statusCode: EnumAwsStatusCodeError.serviceUnavailable,
                    message: 'aws.error.serviceUnavailable',
                });
            }

            uploadedKeys.push(key);
            batchItems.push({
                asset: aws,
                tripId,
                createdBy,
                kind: metadata[i].kind,
                caption: metadata[i].caption ?? null,
                calendarEventId: metadata[i].calendarEventId ?? null,
            });
        }

        let medias;
        try {
            medias = await this.tripAssetRepository.createMediaBatch(
                batchItems
            );
        } catch (err: unknown) {
            await this.deleteAssetsBestEffort(uploadedKeys);
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }

        return { data: this.tripUtil.mapMediaList(medias) };
    }

    async uploadAttachmentBatch(
        tripId: string,
        files: IFile[],
        metadata: TripAttachmentBatchItemRequestDto[],
        tenantId: string,
        createdBy: string
    ): Promise<IResponseReturn<TripAttachmentResponseDto[]>> {
        if (files.length !== metadata.length) {
            throw new UnprocessableEntityException({
                statusCode: EnumRequestStatusCodeError.validation,
                message: 'request.error.validation',
            });
        }

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

        const uploadedKeys: string[] = [];
        const batchItems = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = this.fileService.extractExtensionFromFilename(
                file.originalname
            );
            const key = this.tripUtil.createTripAssetKey(
                tripId,
                'attachment',
                extension
            );
            const aws = await this.awsS3Service.putItem({
                key,
                size: file.size,
                file: file.buffer,
            });

            if (!aws) {
                await this.deleteAssetsBestEffort(uploadedKeys);
                throw new ServiceUnavailableException({
                    statusCode: EnumAwsStatusCodeError.serviceUnavailable,
                    message: 'aws.error.serviceUnavailable',
                });
            }

            uploadedKeys.push(key);
            batchItems.push({
                asset: aws,
                tripId,
                createdBy,
                title: metadata[i].title,
                type: metadata[i].type,
                displayName: metadata[i].displayName ?? null,
            });
        }

        let attachments;
        try {
            attachments =
                await this.tripAssetRepository.createAttachmentBatch(
                    batchItems
                );
        } catch (err: unknown) {
            await this.deleteAssetsBestEffort(uploadedKeys);
            throw new InternalServerErrorException({
                statusCode: EnumAppStatusCodeError.unknown,
                message: 'http.serverError.internalServerError',
                _error: err,
            });
        }

        return { data: this.tripUtil.mapAttachmentList(attachments) };
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

    private async deleteAssetsBestEffort(keys: string[]): Promise<void> {
        if (!keys.length) { return; }
        try {
            await this.awsS3Service.deleteItems(keys);
        } catch (error: unknown) {
            this.logger.warn({ error, keys }, 'Failed to cleanup S3 assets');
        }
    }
}
