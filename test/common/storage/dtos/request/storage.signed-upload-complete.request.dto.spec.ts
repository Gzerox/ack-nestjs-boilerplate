import { StorageSignedUploadCompleteRequestSchema } from '@common/storage/dtos/request/storage.signed-upload-complete.request.dto';

describe('StorageSignedUploadCompleteRequestSchema', () => {
    it('accepts a staged key', () => {
        const body = { key: 'users/user-1/profile/upload-1.png' };

        const result = StorageSignedUploadCompleteRequestSchema.parse(body);

        expect(result).toEqual(body);
    });

    it.each([
        ['an empty key', ''],
        ['a parent segment', 'users/../admin/file.png'],
        ['a leading slash', '/users/user-1/file.png'],
        ['a replacement token', 'users/$&/file.png'],
        ['a query character', 'users/user-1/file.png?x=1'],
        ['an empty segment', 'users//file.png'],
    ])('rejects %s', (_label, key) => {
        const result = StorageSignedUploadCompleteRequestSchema.safeParse({
            key,
        });

        expect(result.success).toBe(false);
    });

    it('rejects a key longer than 1024 characters', () => {
        const result = StorageSignedUploadCompleteRequestSchema.safeParse({
            key: `users/${'a'.repeat(1024)}`,
        });

        expect(result.success).toBe(false);
    });

    it('rejects a client size or visibility', () => {
        const result = StorageSignedUploadCompleteRequestSchema.safeParse({
            key: 'users/user-1/profile/upload-1.png',
            size: 10,
        });

        expect(result.success).toBe(false);
    });
});
