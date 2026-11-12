import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { StorageContentTypeUtil } from '@common/storage/utils/storage.content-type.util';

describe('StorageContentTypeUtil', () => {
    let util: StorageContentTypeUtil;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [StorageContentTypeUtil],
        }).compile();

        util = module.get(StorageContentTypeUtil);
    });

    describe('fromExtension', () => {
        it.each([
            ['png', 'image/png'],
            ['jpg', 'image/jpeg'],
            ['jpeg', 'image/jpeg'],
            ['hbs', 'text/x-handlebars-template'],
        ])('maps %s onto %s', (extension, contentType) => {
            const result = util.fromExtension(extension);

            expect(result).toBe(contentType);
        });

        it('returns null for an extension without a mapping', () => {
            const result = util.fromExtension('unmapped');

            expect(result).toBeNull();
        });
    });

    describe('fromKey', () => {
        it('maps the extension of the last key segment', () => {
            const result = util.fromKey('users/user-1/profile/id-1.jpeg');

            expect(result).toBe('image/jpeg');
        });

        it.each([
            ['a key without an extension', 'users/user-1/profile/id-1'],
            ['a dot only in a parent segment', 'users/v1.2/profile/id-1'],
            ['a trailing dot', 'users/user-1/profile/id-1.'],
            ['an unmapped extension', 'users/user-1/profile/id-1.unmapped'],
        ])('returns null for %s', (_label, key) => {
            const result = util.fromKey(key);

            expect(result).toBeNull();
        });
    });

    describe('fromExtensions', () => {
        it('maps every extension onto its content type and drops duplicates', () => {
            const result = util.fromExtensions(['png', 'jpg', 'jpeg']);

            expect(result).toEqual(['image/png', 'image/jpeg']);
        });

        it('drops an extension without a mapping', () => {
            const result = util.fromExtensions(['png', 'unmapped']);

            expect(result).toEqual(['image/png']);
        });
    });
});
