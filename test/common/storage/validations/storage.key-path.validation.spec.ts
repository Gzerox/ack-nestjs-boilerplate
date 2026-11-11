import { StorageKeyPathSchema } from '@common/storage/validations/storage.key-path.validation';

describe('StorageKeyPathSchema', () => {
    it('joins the wildcard segments into the object key', () => {
        const result = StorageKeyPathSchema.parse([
            'users',
            'user-1',
            'profile',
            'photo.png',
        ]);

        expect(result).toBe('users/user-1/profile/photo.png');
    });

    it.each([
        ['no segment', []],
        ['a parent segment', ['users', '..', 'secret.png']],
        ['an empty segment', ['users', '', 'photo.png']],
        ['a replacement token', ['users', '$&', 'photo.png']],
    ])('rejects %s', (_label, segments) => {
        const result = StorageKeyPathSchema.safeParse(segments);

        expect(result.success).toBe(false);
    });

    it('rejects a key longer than 1024 characters', () => {
        const result = StorageKeyPathSchema.safeParse(['a'.repeat(1025)]);

        expect(result.success).toBe(false);
    });

    it('rejects a value that is not a segment list', () => {
        const result = StorageKeyPathSchema.safeParse('users/photo.png');

        expect(result.success).toBe(false);
    });
});
