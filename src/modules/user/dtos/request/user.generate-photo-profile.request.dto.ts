import { z } from 'zod';
import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { StorageSignedUploadRequestSchema } from '@common/storage/dtos/request/storage.signed-upload.request.dto';

/**
 * Validates the body that requests a signed direct upload of a profile photo.
 * @public
 */
export const UserGeneratePhotoProfileRequestSchema =
    StorageSignedUploadRequestSchema.extend({
        extension: z.enum(EnumFileExtensionImage).meta({
            description: 'Image file extension of the profile photo',
            default: EnumFileExtensionImage.jpg,
            example: EnumFileExtensionImage.jpg,
        }),
    });

/**
 * Body that requests a signed direct upload of a profile photo.
 * @public
 */
export type UserGeneratePhotoProfileRequestDto = z.infer<
    typeof UserGeneratePhotoProfileRequestSchema
>;
