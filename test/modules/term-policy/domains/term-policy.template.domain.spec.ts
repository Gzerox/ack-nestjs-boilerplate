import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import type { IStoredAsset } from '@common/storage/interfaces/storage.interface';
import {
    EnumStorageVisibility,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { TermPolicyContentType } from '@modules/term-policy/constants/term-policy.constant';
import { TermPolicyTemplateDomain } from '@modules/term-policy/domains/term-policy.template.domain';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';

vi.mock(import('node:fs'), () => ({
    readFileSync: vi.fn(),
}));

describe('TermPolicyTemplateDomain', () => {
    const termPolicyUtil: MockProxy<TermPolicyUtil> = mock<TermPolicyUtil>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const template = Buffer.from('<h1>{{title}}</h1>');
    const scopePrefix = 'term-policies/privacy/v1/en/';
    const stored: IStoredAsset = {
        key: 'term-policies/privacy/v1/en/content.hbs',
        visibility: EnumStorageVisibility.public,
        contentType: TermPolicyContentType,
        size: template.length,
        etag: '"etag"',
    };

    let service: TermPolicyTemplateDomain;

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(readFileSync).mockReturnValue(template);
        termPolicyUtil.getContentScopePrefix.mockReturnValue(scopePrefix);
        objectStorageService.store.mockResolvedValue(stored);

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyTemplateDomain,
                { provide: TermPolicyUtil, useValue: termPolicyUtil },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
            ],
        }).compile();
        service = moduleRef.get(TermPolicyTemplateDomain);
    });

    describe('importTemplate', () => {
        it.each([
            [EnumTermPolicyType.termsOfService, 'term-policy.term.en.hbs'],
            [EnumTermPolicyType.privacy, 'term-policy.privacy.en.hbs'],
            [EnumTermPolicyType.cookies, 'term-policy.cookies.en.hbs'],
            [EnumTermPolicyType.marketing, 'term-policy.marketing.en.hbs'],
        ])(
            'writes the %s template onto the public disk under its version 1 language scope and returns the stored metadata',
            async (type, filename) => {
                const result = await service.importTemplate(type);

                expect(readFileSync).toHaveBeenCalledWith(
                    join(
                        process.cwd(),
                        'src/modules/term-policy/templates',
                        filename
                    )
                );
                expect(
                    termPolicyUtil.getContentScopePrefix
                ).toHaveBeenCalledWith(type, 1, EnumMessageLanguage.en);
                expect(objectStorageService.store).toHaveBeenCalledWith(
                    {
                        visibility: EnumStorageVisibility.public,
                        scopePrefix,
                    },
                    { body: template, contentType: TermPolicyContentType }
                );
                expect(result).toEqual(stored);
            }
        );

        it('propagates a template read failure without writing', async () => {
            const failure = new Error('template missing');
            vi.mocked(readFileSync).mockImplementation(() => {
                throw failure;
            });

            await expect(
                service.importTemplate(EnumTermPolicyType.privacy)
            ).rejects.toBe(failure);
            expect(objectStorageService.store).not.toHaveBeenCalled();
        });

        it('surfaces the typed storage exception of a failed write', async () => {
            const exception = new StorageServiceUnavailableException();
            objectStorageService.store.mockRejectedValue(exception);

            await expect(
                service.importTemplate(EnumTermPolicyType.privacy)
            ).rejects.toBe(exception);
        });
    });
});
