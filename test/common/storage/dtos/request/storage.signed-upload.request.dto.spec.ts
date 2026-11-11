import { StorageSignedUploadRequestSchema } from '@common/storage/dtos/request/storage.signed-upload.request.dto';

describe('StorageSignedUploadRequestSchema', () => {
    it('accepts a positive integer size', () => {
        const result = StorageSignedUploadRequestSchema.parse({ size: 1 });

        expect(result).toEqual({ size: 1 });
    });

    it.each([
        ['zero', 0],
        ['a negative size', -10],
        ['a non-integer size', 1.5],
    ])('rejects %s', (_label, size) => {
        const result = StorageSignedUploadRequestSchema.safeParse({ size });

        expect(result.success).toBe(false);
    });

    it('rejects a size above the maximum the composing feature supplies', () => {
        const schema = StorageSignedUploadRequestSchema.extend({
            size: StorageSignedUploadRequestSchema.shape.size.max(100),
        });

        expect(schema.safeParse({ size: 100 }).success).toBe(true);
        expect(schema.safeParse({ size: 101 }).success).toBe(false);
    });

    it('rejects an undeclared key', () => {
        const result = StorageSignedUploadRequestSchema.safeParse({
            size: 1,
            visibility: 'public',
        });

        expect(result.success).toBe(false);
    });
});
