import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import type { IStorageSignedUpload } from '@common/storage/interfaces/storage.interface';
import {
    EnumStorageVisibility,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { TermPolicyContentDomain } from '@modules/term-policy/domains/term-policy.content.domain';
import { TermPolicyContentHttpService } from '@modules/term-policy/services/term-policy.content.http.service';

describe('TermPolicyContentHttpService', () => {
    const termPolicyContentDomain: MockProxy<TermPolicyContentDomain> =
        mock<TermPolicyContentDomain>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const now = new Date('2026-01-01T00:00:00.000Z');
    const upload = {
        language: EnumMessageLanguage.en,
        key: 'term-policies/privacy/v1/en/staged.hbs',
    };

    let service: TermPolicyContentHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyContentHttpService,
                {
                    provide: TermPolicyContentDomain,
                    useValue: termPolicyContentDomain,
                },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
            ],
        }).compile();

        service = module.get(TermPolicyContentHttpService);
    });

    describe('generateContentPresignByAdmin', () => {
        it('wraps the signed upload the domain issued', async () => {
            const signedUpload: IStorageSignedUpload = {
                key: upload.key,
                url: 'https://storage.example.com/upload?signature=abc',
                method: 'PUT',
                headers: { 'content-type': 'text/x-handlebars-template' },
                expiresAt: now,
            };
            const body = {
                type: EnumTermPolicyType.privacy,
                version: 1,
                language: EnumMessageLanguage.en,
                size: 100,
            };
            termPolicyContentDomain.generateContentPresignByAdmin.mockResolvedValue(
                signedUpload
            );

            const result = await service.generateContentPresignByAdmin(body);

            expect(
                termPolicyContentDomain.generateContentPresignByAdmin
            ).toHaveBeenCalledWith(body);
            expect(result).toEqual({ data: signedUpload });
        });
    });

    describe('updateContentByAdmin', () => {
        it('hands the completion to the domain', async () => {
            const result = await service.updateContentByAdmin(
                'term-id',
                upload
            );

            expect(
                termPolicyContentDomain.updateContentByAdmin
            ).toHaveBeenCalledWith('term-id', upload);
            expect(result).toEqual({});
        });
    });

    describe('addContentByAdmin', () => {
        it('hands the completion to the domain', async () => {
            const result = await service.addContentByAdmin('term-id', upload);

            expect(
                termPolicyContentDomain.addContentByAdmin
            ).toHaveBeenCalledWith('term-id', upload);
            expect(result).toEqual({});
        });
    });

    describe('removeContentByAdmin', () => {
        it('hands the language to the domain', async () => {
            const result = await service.removeContentByAdmin('term-id', {
                language: EnumMessageLanguage.en,
            });

            expect(
                termPolicyContentDomain.removeContentByAdmin
            ).toHaveBeenCalledWith('term-id', EnumMessageLanguage.en);
            expect(result).toEqual({});
        });
    });

    describe('getContentByAdmin', () => {
        it('resolves the stable public URL of the content with no expiry', async () => {
            const asset = {
                key: 'term-policies/privacy/v1/en/published.hbs',
                visibility: EnumStorageVisibility.public,
            };
            termPolicyContentDomain.getContentByAdmin.mockResolvedValue(asset);
            objectStorageService.publicUrl.mockReturnValue(
                'https://cdn.example.com/term-policies/privacy/v1/en/published.hbs'
            );

            const result = await service.getContentByAdmin(
                'term-id',
                EnumMessageLanguage.en
            );

            expect(objectStorageService.publicUrl).toHaveBeenCalledWith(asset);
            expect(result).toEqual({
                data: {
                    url: 'https://cdn.example.com/term-policies/privacy/v1/en/published.hbs',
                },
            });
        });
    });
});
