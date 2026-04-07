import { InternalServerErrorException } from '@nestjs/common';
import { FileService } from '@common/file/services/file.service';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { TripRepository } from '@modules/trip/repositories/trip.repository';
import { EnumTripStatusCodeError } from '@modules/trip/enums/trip.status-code.enum';
import { HelperService } from '@common/helper/services/helper.service';

export async function generateUniqueSlug(
    title: string,
    tripRepository: TripRepository,
    helperService: HelperService
): Promise<string> {
    const base = title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    for (let attempt = 0; attempt < 3; attempt++) {
        const suffix = helperService.randomString(6);
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

export function createTripAssetKey(
    tripId: string,
    field: 'icon' | 'coverImage',
    extension: EnumFileExtensionImage,
    fileService: FileService
): string {
    const path =
        field === 'icon'
            ? `trips/${tripId}/icon`
            : `trips/${tripId}/cover-image`;

    return fileService.createRandomFilename({
        path,
        extension,
        randomLength: 20,
    });
}
