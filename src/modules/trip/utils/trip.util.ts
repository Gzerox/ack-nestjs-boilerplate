import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FileService } from '@common/file/services/file.service';
import { HelperService } from '@common/helper/services/helper.service';
import { TripCalendarEventResponseDto } from '@modules/trip/dtos/response/trip-calendar-event.response.dto';
import { TripAttachmentResponseDto } from '@modules/trip/dtos/response/trip-attachment.response.dto';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';
import { TripInviteResponseDto } from '@modules/trip/dtos/response/trip-invite.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TripMediaResponseDto } from '@modules/trip/dtos/response/trip-media.response.dto';
import { TripPublicResponseDto } from '@modules/trip/dtos/response/trip-public.response.dto';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import {
    ITripInviteTripSummary,
    ITripInviteWithTrip,
} from '@modules/trip/interfaces/trip-invite.interface';
import {
    ITripAttachmentWithAsset,
    ITripCalendarEventWithMedias,
    ITripContactWithContact,
    ITripDetail,
    ITripMediaWithAsset,
    ITripPublicSummary,
} from '@modules/trip/interfaces/trip.interface';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { plainToInstance } from 'class-transformer';
import { Trip, TripInvite } from '@generated/prisma-client';

@Injectable()
export class TripUtil {
    constructor(
        private readonly helperService: HelperService,
        private readonly fileService: FileService
    ) {}

    async generateUniqueSlug(
        title: string,
        tripRepository: TripRepository
    ): Promise<string> {
        const base = title
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        for (let attempt = 0; attempt < 3; attempt++) {
            const suffix = this.helperService.randomString(6);
            const slug = `${base}-${suffix}`;
            const taken = await tripRepository.existsBySlug(slug);
            if (!taken) {
                return slug;
            }
        }

        throw new InternalServerErrorException({
            statusCode: EnumTripStatusCodeError.slugConflict,
            message: 'trip.error.slugConflict',
        });
    }

    createTripAssetKey(
        tripId: string,
        field: 'icon' | 'coverImage' | 'media' | 'attachment',
        extension: string
    ): string {
        const pathMap: Record<typeof field, string> = {
            icon: `trips/${tripId}/icon`,
            coverImage: `trips/${tripId}/cover-image`,
            media: `trips/${tripId}/media`,
            attachment: `trips/${tripId}/attachments`,
        };

        return this.fileService.createRandomFilename({
            path: pathMap[field],
            extension,
            randomLength: 20,
        });
    }

    mapList(
        trips?: Array<Trip | ITripInviteTripSummary> | null
    ): TripListItemResponseDto[] {
        return plainToInstance(TripListItemResponseDto, trips ?? []);
    }

    mapResponse(trip: ITripDetail): TripResponseDto {
        return plainToInstance(TripResponseDto, {
            ...trip,
            calendarEvents: this.mapCalendarEventList(trip.calendarEvents),
            invites: this.mapInviteList(trip.invites),
            contacts: this.mapTripContactList(trip.contacts),
            medias: this.mapMediaList(trip.medias),
            attachments: this.mapAttachmentList(trip.attachments),
        });
    }

    mapPublicResponse(trip: ITripPublicSummary): TripPublicResponseDto {
        return plainToInstance(TripPublicResponseDto, {
            slug: trip.slug,
            title: trip.title,
            subtitle: trip.subtitle,
            iconUrl: trip.icon?.completedUrl ?? null,
            coverImageUrl: trip.coverImage?.completedUrl ?? null,
            startDate: trip.startDate,
            endDate: trip.endDate,
            timezone: trip.timezone,
        });
    }

    mapCalendarEventList(
        calendarEvents?: ITripCalendarEventWithMedias[] | null
    ): TripCalendarEventResponseDto[] {
        return plainToInstance(
            TripCalendarEventResponseDto,
            (calendarEvents ?? []).map(calendarEvent => ({
                ...calendarEvent,
                medias: this.mapMediaList(calendarEvent.medias),
            }))
        );
    }

    mapMediaList(
        medias?: ITripMediaWithAsset[] | null
    ): TripMediaResponseDto[] {
        return plainToInstance(
            TripMediaResponseDto,
            (medias ?? []).map(media => ({
                ...media,
                file: media.asset,
            }))
        );
    }

    mapAttachmentList(
        attachments?: ITripAttachmentWithAsset[] | null
    ): TripAttachmentResponseDto[] {
        return plainToInstance(
            TripAttachmentResponseDto,
            (attachments ?? []).map(attachment => ({
                ...attachment,
                file: attachment.asset,
            }))
        );
    }

    mapInviteList(invites?: TripInvite[] | null): TripInviteResponseDto[] {
        return plainToInstance(TripInviteResponseDto, invites ?? []);
    }

    mapInviteListItemList(
        invites?: ITripInviteWithTrip[] | null
    ): TripInviteListItemResponseDto[] {
        return plainToInstance(TripInviteListItemResponseDto, invites ?? []);
    }

    mapTripContactList(
        contacts?: ITripContactWithContact[] | null
    ): TenantContactResponseDto[] {
        return plainToInstance(
            TenantContactResponseDto,
            (contacts ?? []).map(({ contact }) => contact)
        );
    }
}
