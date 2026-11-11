import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { StorageAssetExample } from '@common/storage/constants/storage.constant';
import { StorageAssetResponseSchema } from '@common/storage/dtos/response/storage.asset.response.dto';

describe('StorageAssetResponseSchema', () => {
    const publicAsset = {
        key: 'users/user-1/profile/photo.png',
        visibility: EnumStorageVisibility.public,
        contentType: 'image/png',
        url: 'https://cdn.example.com/users/user-1/profile/photo.png',
    };

    it('keeps the declared fields of a public asset with its url', () => {
        const result = StorageAssetResponseSchema.parse(publicAsset);

        expect(result).toEqual(publicAsset);
    });

    it('accepts a private asset with a null url', () => {
        const privateAsset = {
            ...publicAsset,
            visibility: EnumStorageVisibility.private,
            url: null,
        };

        const result = StorageAssetResponseSchema.parse(privateAsset);

        expect(result).toEqual(privateAsset);
    });

    it('strips the stored size and etag and undeclared provider fields', () => {
        const result = StorageAssetResponseSchema.parse({
            ...publicAsset,
            size: 2048,
            etag: '"etag-1"',
            bucket: 'ack-public',
            completedUrl: 'https://bucket.s3.amazonaws.com/key',
            path: '/var/storage/public/key',
        });

        expect(result).toEqual(publicAsset);
    });

    it('rejects an unknown visibility', () => {
        const result = StorageAssetResponseSchema.safeParse({
            ...publicAsset,
            visibility: 'protected',
        });

        expect(result.success).toBe(false);
    });

    it('accepts the shared example and exposes no size or etag in it', () => {
        const result =
            StorageAssetResponseSchema.safeParse(StorageAssetExample);

        expect(result.success).toBe(true);
        expect(StorageAssetExample).not.toHaveProperty('size');
        expect(StorageAssetExample).not.toHaveProperty('etag');
    });
});
