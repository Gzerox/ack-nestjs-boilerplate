import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FileService } from '@common/file/services/file.service';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { HelperService } from '@common/helper/services/helper.service';
import { TripCalendarEventResponseDto } from '@modules/trip/dtos/response/trip-calendar-event.response.dto';
import { TripInviteListItemResponseDto } from '@modules/trip/dtos/response/trip-invite.list-item.response.dto';
import { TripInviteResponseDto } from '@modules/trip/dtos/response/trip-invite.response.dto';
import { TripListItemResponseDto } from '@modules/trip/dtos/response/trip.list-item.response.dto';
import { TenantContactResponseDto } from '@modules/trip/dtos/response/tenant-contact.response.dto';
import { TripResponseDto } from '@modules/trip/dtos/response/trip.response.dto';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import {
    ITripInviteTripSummary,
    ITripInviteWithTrip,
} from '@modules/trip/interfaces/trip-invite.interface';
import {
    ITripContactWithContact,
    ITripDetail,
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
        field: 'icon' | 'coverImage',
        extension: EnumFileExtensionImage
    ): string {
        const path =
            field === 'icon'
                ? `trips/${tripId}/icon`
                : `trips/${tripId}/cover-image`;

        return this.fileService.createRandomFilename({
            path,
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
            calendarEvents: plainToInstance(
                TripCalendarEventResponseDto,
                trip.calendarEvents
            ),
            invites: this.mapInviteList(trip.invites),
            contacts: this.mapTripContactList(trip.contacts),
        });
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
