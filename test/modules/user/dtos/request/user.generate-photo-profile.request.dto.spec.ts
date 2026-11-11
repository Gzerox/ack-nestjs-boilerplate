import { EnumFileExtensionImage } from '@common/file/enums/file.enum';
import { UserGeneratePhotoProfileRequestSchema } from '@modules/user/dtos/request/user.generate-photo-profile.request.dto';

describe('UserGeneratePhotoProfileRequestSchema', () => {
    it('accepts an image extension with a positive integer size', () => {
        const result = UserGeneratePhotoProfileRequestSchema.parse({
            extension: EnumFileExtensionImage.png,
            size: 1024,
        });

        expect(result).toEqual({
            extension: EnumFileExtensionImage.png,
            size: 1024,
        });
    });

    it('leaves the configured maximum to the domain and accepts a large size', () => {
        const result = UserGeneratePhotoProfileRequestSchema.safeParse({
            extension: EnumFileExtensionImage.png,
            size: 104857600,
        });

        expect(result.success).toBe(true);
    });

    it.each([
        { extension: EnumFileExtensionImage.png, size: 0 },
        { extension: EnumFileExtensionImage.png, size: -1 },
        { extension: EnumFileExtensionImage.png, size: 1.5 },
        { extension: 'pdf', size: 100 },
        {
            extension: EnumFileExtensionImage.png,
            size: 100,
            visibility: 'public',
        },
    ])(
        'rejects a non-positive or non-integer size, a non-image extension or an unknown key',
        input => {
            expect(
                UserGeneratePhotoProfileRequestSchema.safeParse(input).success
            ).toBe(false);
        }
    );
});
