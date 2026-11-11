import { z } from 'zod';
import {
    StorageObjectKeyMaxLength,
    StorageObjectKeyRegex,
    StorageObjectKeyStructureInvalidRegex,
} from '@common/storage/constants/storage.constant';

/**
 * Validates an Express 5 wildcard route parameter (`*key`) and joins its segments into the object key.
 */
export const StorageKeyPathSchema = z
    .array(z.string())
    .min(1)
    .transform(segments => segments.join('/'))
    .pipe(
        z
            .string()
            .max(StorageObjectKeyMaxLength)
            .regex(StorageObjectKeyRegex)
            .refine(key => !StorageObjectKeyStructureInvalidRegex.test(key))
            .meta({
                description: 'Object key of the stored file',
                example:
                    'users/0199a7a4-7c1e-7cc3-9d6e-4a6b2f1f0c11/profile/photo.jpg',
            })
    );
