import type { z } from 'zod';
import { StorageSignedUploadCompleteRequestSchema } from '@common/storage/dtos/request/storage.signed-upload-complete.request.dto';

/**
 * Validates the body that completes a signed direct upload of a profile photo: the upload key, and nothing else.
 * @public
 */
export const UserUpdateProfilePhotoRequestSchema =
    StorageSignedUploadCompleteRequestSchema.extend({});

/**
 * Body that completes a signed direct upload of a profile photo.
 * @public
 */
export type UserUpdateProfilePhotoRequestDto = z.infer<
    typeof UserUpdateProfilePhotoRequestSchema
>;
