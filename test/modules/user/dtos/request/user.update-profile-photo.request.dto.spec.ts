import { UserUpdateProfilePhotoRequestSchema } from '@modules/user/dtos/request/user.update-profile-photo.request.dto';

describe('UserUpdateProfilePhotoRequestSchema', () => {
    it('accepts the staging key alone', () => {
        const result = UserUpdateProfilePhotoRequestSchema.parse({
            key: 'incoming/users/user-id/profile/photo.png',
        });

        expect(result).toEqual({
            key: 'incoming/users/user-id/profile/photo.png',
        });
    });

    it.each([
        { key: 'incoming/users/user-id/profile/photo.png', size: 100 },
        { key: 'incoming/users/../profile/photo.png' },
        { key: '/incoming/users/user-id/profile/photo.png' },
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
