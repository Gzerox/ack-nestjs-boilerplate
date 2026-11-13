import { UserUpdateProfilePhotoRequestSchema } from '@modules/user/dtos/request/user.update-profile-photo.request.dto';

describe('UserUpdateProfilePhotoRequestSchema', () => {
    it('accepts the staging key alone', () => {
        const result = UserUpdateProfilePhotoRequestSchema.parse({
            key: 'users/user-id/profile/photo.png',
        });

        expect(result).toEqual({
            key: 'users/user-id/profile/photo.png',
        });
    });

    it.each([
        { key: 'users/user-id/profile/photo.png', size: 100 },
        { key: 'users/../profile/photo.png' },
        { key: '/users/user-id/profile/photo.png' },
        {},
    ])(
        'rejects a client size, a traversal or absolute key, or a missing key',
        input => {
            expect(
                UserUpdateProfilePhotoRequestSchema.safeParse(input).success
            ).toBe(false);
        }
    );
});
