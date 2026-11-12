import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageContentTypeInvalidException } from '@common/storage/exceptions/storage.content-type-invalid.exception';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import { StorageObjectNotFoundException } from '@common/storage/exceptions/storage.object-not-found.exception';
import { StorageSizeInvalidException } from '@common/storage/exceptions/storage.size-invalid.exception';
import type {
    IStorageSignedDownload,
    IStorageSignedUpload,
    IStorageVerifyRules,
    IStoredAsset,
} from '@common/storage/interfaces/storage.interface';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
    EnumTermPolicyStatus,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import type { TermPolicyContent } from '@generated/prisma-client/client';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import type { IActivityLogStagedEvent } from '@modules/activity-log/interfaces/activity-log.interface';
import { TermPolicyContentType } from '@modules/term-policy/constants/term-policy.constant';
import { EnumTermPolicyStatusCodeError } from '@modules/term-policy/enums/term-policy.status-code.enum';
import { TermPolicyContentExistException } from '@modules/term-policy/exceptions/term-policy.content-exist.exception';
import { TermPolicyContentNotFoundException } from '@modules/term-policy/exceptions/term-policy.content-not-found.exception';
import { TermPolicyNotFoundException } from '@modules/term-policy/exceptions/term-policy.not-found.exception';
import { TermPolicyStatusInvalidException } from '@modules/term-policy/exceptions/term-policy.status-invalid.exception';
import type { ITermPolicy } from '@modules/term-policy/interfaces/term-policy.interface';
import { TermPolicyRepository } from '@modules/term-policy/repositories/term-policy.repository';
import { TermPolicyContentDomain } from '@modules/term-policy/domains/term-policy.content.domain';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';

describe('TermPolicyContentDomain', () => {
    const termPolicyRepository: MockProxy<TermPolicyRepository> =
        mock<TermPolicyRepository>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const termPolicyUtil: MockProxy<TermPolicyUtil> = mock<TermPolicyUtil>();
    const activityLogDomain: MockProxy<ActivityLogDomain> =
        mock<ActivityLogDomain>();
    const helperDateService: MockProxy<HelperDateService> =
        mock<HelperDateService>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>();

    const now = new Date('2026-01-01T00:00:00.000Z');
    const maxSizeInBytes = 4096;
    const scopePrefix = 'term-policies/privacy/v1/en/';
    const verifiedKey = 'term-policies/privacy/v1/en/upload.hbs';
    const preparedEvent: IActivityLogStagedEvent = {
        action: EnumActivityLogAction.adminTermPolicyAddContent,
        metadata: {},
        onError: false,
    };
    const existingContent: TermPolicyContent = {
        id: 'content-id',
        termPolicyId: 'term-id',
        language: EnumMessageLanguage.en,
        key: 'term-policies/privacy/v1/en/old.hbs',
        visibility: EnumStorageVisibility.private,
        contentType: TermPolicyContentType,
        size: BigInt(100),
        etag: null,
    };
    const draft: ITermPolicy = {
        id: 'term-id',
        type: EnumTermPolicyType.privacy,
        version: 1,
        status: EnumTermPolicyStatus.draft,
        publishedAt: null,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        contents: [existingContent],
    };
    const emptyDraft: ITermPolicy = { ...draft, contents: [] };
    const verified: IStoredAsset = {
        key: verifiedKey,
        visibility: EnumStorageVisibility.public,
        contentType: TermPolicyContentType,
        size: 200,
        etag: '"verified"',
    };

    let service: TermPolicyContentDomain;

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values = {
                'termPolicy.content.maxSizeInBytes': maxSizeInBytes,
            };

            return values[key as keyof typeof values];
        });
        helperDateService.create.mockReturnValue(now);
        activityLogDomain.prepare.mockReturnValue(preparedEvent);
        termPolicyUtil.mapActivityLogMetadata.mockReturnValue({});
        termPolicyUtil.getContentScopePrefix.mockReturnValue(scopePrefix);
        termPolicyUtil.getContentByLanguage.mockImplementation(
            (contents, language) =>
                contents.find(content => content.language === language) ?? null
        );
        termPolicyUtil.createContentFilename.mockReturnValue(
            'privacy-v1-en.hbs'
        );
        termPolicyRepository.findOneById.mockResolvedValue(draft);
        objectStorageService.verifyUpload.mockResolvedValue(verified);
        objectStorageService.deleteQuietly.mockResolvedValue();

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyContentDomain,
                {
                    provide: TermPolicyRepository,
                    useValue: termPolicyRepository,
                },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
                { provide: TermPolicyUtil, useValue: termPolicyUtil },
                { provide: ActivityLogDomain, useValue: activityLogDomain },
                { provide: HelperDateService, useValue: helperDateService },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();
        service = moduleRef.get(TermPolicyContentDomain);
    });

    describe('generateContentPresignByAdmin', () => {
        const presign = {
            language: EnumMessageLanguage.en,
            size: 200,
            type: EnumTermPolicyType.privacy,
            version: 1,
        };

        it('creates a private signed upload scoped to the policy language with the template content type', async () => {
            const signedUpload: IStorageSignedUpload = {
                key: verifiedKey,
                url: 'https://storage.example.com/upload?signature=abc',
                method: 'PUT',
                headers: { 'content-type': TermPolicyContentType },
                expiresAt: now,
            };
            termPolicyRepository.findStatusByVersionAndType.mockResolvedValue(
                EnumTermPolicyStatus.draft
            );
            objectStorageService.createSignedUpload.mockResolvedValue(
                signedUpload
            );

            const result = await service.generateContentPresignByAdmin(presign);

            expect(termPolicyUtil.getContentScopePrefix).toHaveBeenCalledWith(
                EnumTermPolicyType.privacy,
                1,
                EnumMessageLanguage.en
            );
            expect(
                objectStorageService.createSignedUpload
            ).toHaveBeenCalledWith(scopePrefix, {
                contentType: TermPolicyContentType,
                size: 200,
            });
            expect(result).toEqual(signedUpload);
        });

        it('signs an upload for a version that does not exist yet', async () => {
            termPolicyRepository.findStatusByVersionAndType.mockResolvedValue(
                null
            );

            await service.generateContentPresignByAdmin(presign);

            expect(objectStorageService.createSignedUpload).toHaveBeenCalled();
        });

        it('throws TermPolicyStatusInvalidException without signing for a published version', async () => {
            termPolicyRepository.findStatusByVersionAndType.mockResolvedValue(
                EnumTermPolicyStatus.published
            );

            await expect(
                service.generateContentPresignByAdmin(presign)
            ).rejects.toMatchObject({
                module: 'termPolicy',
                statusCode: EnumTermPolicyStatusCodeError.statusInvalid,
            });
            expect(
                objectStorageService.createSignedUpload
            ).not.toHaveBeenCalled();
        });

        it('throws TermPolicyContentSizeExceededException without signing above the configured content maximum', async () => {
            termPolicyRepository.findStatusByVersionAndType.mockResolvedValue(
                null
            );

            await expect(
                service.generateContentPresignByAdmin({
                    ...presign,
                    size: maxSizeInBytes + 1,
                })
            ).rejects.toMatchObject({
                module: 'termPolicy',
                statusCode: EnumTermPolicyStatusCodeError.contentSizeExceeded,
                statusCodeKey:
                    EnumTermPolicyStatusCodeError[
                        EnumTermPolicyStatusCodeError.contentSizeExceeded
                    ],
                messagePath: 'termPolicy.error.contentSizeExceeded',
                httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
            });
            expect(
                objectStorageService.createSignedUpload
            ).not.toHaveBeenCalled();
        });
    });

    describe('verifyContent', () => {
        it('verifies the uploaded key against the policy language scope, the content maximum and the template detector', async () => {
            let rules: IStorageVerifyRules | undefined;
            objectStorageService.verifyUpload.mockImplementation(
                async (_key, verifyRules) => {
                    rules = verifyRules;
                    return verified;
                }
            );
            termPolicyUtil.detectTemplateContentType.mockReturnValue(
                TermPolicyContentType
            );

            const result = await service.verifyContent(draft, {
                language: EnumMessageLanguage.en,
                key: verifiedKey,
            });

            expect(objectStorageService.verifyUpload).toHaveBeenCalledWith(
                verifiedKey,
                expect.objectContaining({
                    scopePrefix,
                    maxSizeInBytes,
                    contentTypes: [TermPolicyContentType],
                })
            );
            const head = new Uint8Array([0x7b]);
            expect(rules?.detect?.(head)).toBe(TermPolicyContentType);
            expect(
                termPolicyUtil.detectTemplateContentType
            ).toHaveBeenCalledWith(head);
            expect(result).toEqual({
                ...verified,
                language: EnumMessageLanguage.en,
            });
        });
    });

    describe('addContentByAdmin', () => {
        const upload = { language: EnumMessageLanguage.en, key: verifiedKey };

        beforeEach(() => {
            termPolicyRepository.findOneById.mockResolvedValue(emptyDraft);
        });

        it('throws TermPolicyNotFoundException without verifying for an unknown policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(null);

            await expect(
                service.addContentByAdmin('term-id', upload)
            ).rejects.toBeInstanceOf(TermPolicyNotFoundException);
            expect(objectStorageService.verifyUpload).not.toHaveBeenCalled();
        });

        it('throws TermPolicyStatusInvalidException without verifying after publication', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...emptyDraft,
                status: EnumTermPolicyStatus.published,
            });

            await expect(
                service.addContentByAdmin('term-id', upload)
            ).rejects.toBeInstanceOf(TermPolicyStatusInvalidException);
            expect(objectStorageService.verifyUpload).not.toHaveBeenCalled();
        });

        it('throws TermPolicyContentExistException without verifying when the language exists', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(draft);

            await expect(
                service.addContentByAdmin('term-id', upload)
            ).rejects.toMatchObject({
                module: 'termPolicy',
                statusCode: EnumTermPolicyStatusCodeError.contentExist,
            });
            expect(objectStorageService.verifyUpload).not.toHaveBeenCalled();
        });

        it.each([
            ['a foreign or traversal key', new StorageKeyInvalidException()],
            ['a missing uploaded object', new StorageObjectNotFoundException()],
            [
                'an uploaded object that is not a template',
                new StorageContentTypeInvalidException(),
            ],
            ['an oversize uploaded object', new StorageSizeInvalidException()],
        ])(
            'rejects %s with no promotion and no database write',
            async (_case, exception) => {
                objectStorageService.verifyUpload.mockRejectedValue(exception);

                await expect(
                    service.addContentByAdmin('term-id', upload)
                ).rejects.toBe(exception);
                expect(termPolicyRepository.addContent).not.toHaveBeenCalled();
            }
        );

        it('stores the verified metadata and stages the activity', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.addContent.mockImplementation(async () => {
                callOrder.push('add');
                return draft;
            });
            objectStorageService.deleteQuietly.mockImplementation(
                async ({ key }) => {
                    callOrder.push(`delete:${key}`);
                }
            );

            await service.addContentByAdmin('term-id', upload);

            expect(termPolicyRepository.addContent).toHaveBeenCalledWith(
                'term-id',
                { ...verified, language: EnumMessageLanguage.en }
            );
            expect(activityLogDomain.prepare).toHaveBeenCalledWith({
                action: EnumActivityLogAction.adminTermPolicyAddContent,
                metadata: {},
            });
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
            expect(callOrder).toEqual(['add']);
        });

        it('deletes the verified object and rethrows as AppUnknownException when the database write fails', async () => {
            termPolicyRepository.addContent.mockRejectedValue(new Error('db'));

            await expect(
                service.addContentByAdmin('term-id', upload)
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledTimes(1);
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: verified.key,
                    visibility: verified.visibility,
                })
            );
            expect(activityLogDomain.stagePrepared).not.toHaveBeenCalled();
        });

        it('rethrows a typed exception unchanged after compensating', async () => {
            const exception = new TermPolicyContentExistException();
            termPolicyRepository.addContent.mockRejectedValue(exception);

            await expect(
                service.addContentByAdmin('term-id', upload)
            ).rejects.toBe(exception);
        });
    });

    describe('updateContentByAdmin', () => {
        const upload = { language: EnumMessageLanguage.en, key: verifiedKey };

        it('throws TermPolicyContentNotFoundException without verifying when the language is absent', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(emptyDraft);

            await expect(
                service.updateContentByAdmin('term-id', upload)
            ).rejects.toMatchObject({
                module: 'termPolicy',
                statusCode: EnumTermPolicyStatusCodeError.contentNotFound,
                messagePath: 'termPolicy.error.contentNotFound',
            });
            expect(objectStorageService.verifyUpload).not.toHaveBeenCalled();
        });

        it('rejects a foreign key with no database write', async () => {
            objectStorageService.verifyUpload.mockRejectedValue(
                new StorageKeyInvalidException()
            );

            await expect(
                service.updateContentByAdmin('term-id', upload)
            ).rejects.toBeInstanceOf(StorageKeyInvalidException);
            expect(termPolicyRepository.updateContent).not.toHaveBeenCalled();
        });

        it('replaces the content row, then deletes the previous object', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.updateContent.mockImplementation(async () => {
                callOrder.push('update');
                return draft;
            });
            objectStorageService.deleteQuietly.mockImplementation(
                async ({ key }) => {
                    callOrder.push(`delete:${key}`);
                }
            );

            await service.updateContentByAdmin('term-id', upload);

            expect(termPolicyRepository.updateContent).toHaveBeenCalledWith(
                'term-id',
                { ...verified, language: EnumMessageLanguage.en }
            );
            expect(callOrder[0]).toBe('update');
            expect(callOrder).toEqual(
                expect.arrayContaining([`delete:${existingContent.key}`])
            );
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: existingContent.key,
                    visibility: EnumStorageVisibility.private,
                })
            );
        });

        it('deletes only the new final object and rethrows when the database write fails', async () => {
            termPolicyRepository.updateContent.mockRejectedValue(
                new Error('db')
            );

            await expect(
                service.updateContentByAdmin('term-id', upload)
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledTimes(1);
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: verified.key,
                    visibility: verified.visibility,
                })
            );
        });
    });

    describe('removeContentByAdmin', () => {
        it('throws TermPolicyContentNotFoundException when the language is absent', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(emptyDraft);

            await expect(
                service.removeContentByAdmin('term-id', EnumMessageLanguage.en)
            ).rejects.toBeInstanceOf(TermPolicyContentNotFoundException);
            expect(termPolicyRepository.removeContent).not.toHaveBeenCalled();
        });

        it('deletes the row first, then the private object', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.removeContent.mockImplementation(async () => {
                callOrder.push('remove');
                return draft;
            });
            objectStorageService.deleteQuietly.mockImplementation(async () => {
                callOrder.push('delete');
            });

            await service.removeContentByAdmin(
                'term-id',
                EnumMessageLanguage.en
            );

            expect(termPolicyRepository.removeContent).toHaveBeenCalledWith(
                'term-id',
                { language: EnumMessageLanguage.en }
            );
            expect(objectStorageService.deleteQuietly).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: existingContent.key,
                    visibility: existingContent.visibility,
                })
            );
            expect(callOrder).toEqual(['remove', 'delete']);
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
        });

        it('keeps the object and rethrows as AppUnknownException when the row delete fails', async () => {
            termPolicyRepository.removeContent.mockRejectedValue(
                new Error('db')
            );

            await expect(
                service.removeContentByAdmin('term-id', EnumMessageLanguage.en)
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
        });
    });

    describe('getContentByAdmin', () => {
        it('throws TermPolicyNotFoundException for an unknown policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(null);

            await expect(
                service.getContentByAdmin('term-id', EnumMessageLanguage.en)
            ).rejects.toBeInstanceOf(TermPolicyNotFoundException);
        });

        it('throws TermPolicyContentNotFoundException for a missing language', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(emptyDraft);

            await expect(
                service.getContentByAdmin('term-id', EnumMessageLanguage.en)
            ).rejects.toBeInstanceOf(TermPolicyContentNotFoundException);
            expect(objectStorageService.signedDownload).not.toHaveBeenCalled();
        });

        it('returns a signed attachment download for a private draft content', async () => {
            const signedDownload: IStorageSignedDownload = {
                url: 'https://storage.example.com/download?signature=abc',
                expiresAt: now,
            };
            objectStorageService.signedDownload.mockResolvedValue(
                signedDownload
            );

            const result = await service.getContentByAdmin(
                'term-id',
                EnumMessageLanguage.en
            );

            expect(objectStorageService.signedDownload).toHaveBeenCalledWith(
                {
                    key: existingContent.key,
                    visibility: EnumStorageVisibility.private,
                },
                { disposition: 'attachment', filename: 'privacy-v1-en.hbs' }
            );
            expect(result).toEqual({
                asset: {
                    key: existingContent.key,
                    visibility: EnumStorageVisibility.private,
                },
                signedDownload,
            });
        });

        it('returns the public asset reference with no signed download for a published content', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...draft,
                status: EnumTermPolicyStatus.published,
                contents: [
                    {
                        ...existingContent,
                        visibility: EnumStorageVisibility.public,
                    },
                ],
            });
            const result = await service.getContentByAdmin(
                'term-id',
                EnumMessageLanguage.en
            );

            expect(result).toEqual({
                asset: {
                    key: existingContent.key,
                    visibility: EnumStorageVisibility.public,
                },
                signedDownload: null,
            });
            expect(objectStorageService.publicUrl).not.toHaveBeenCalled();
            expect(objectStorageService.signedDownload).not.toHaveBeenCalled();
        });
    });

    describe('prepareActivityLog', () => {
        it('prepares the action with the policy metadata', () => {
            termPolicyUtil.mapActivityLogMetadata.mockReturnValue({
                termPolicyId: 'term-id',
            });

            const result = service['prepareActivityLog'](
                EnumActivityLogAction.adminTermPolicyRemoveContent,
                draft,
                now
            );

            expect(termPolicyUtil.mapActivityLogMetadata).toHaveBeenCalledWith(
                draft,
                now
            );
            expect(activityLogDomain.prepare).toHaveBeenCalledWith({
                action: EnumActivityLogAction.adminTermPolicyRemoveContent,
                metadata: { termPolicyId: 'term-id' },
            });
            expect(result).toBe(preparedEvent);
        });
    });

    describe('findOneDraftById', () => {
        it('returns a draft policy', async () => {
            const result = await service['findOneDraftById']('term-id');

            expect(result).toBe(draft);
        });

        it('throws TermPolicyNotFoundException for an unknown policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(null);

            await expect(
                service['findOneDraftById']('term-id')
            ).rejects.toBeInstanceOf(TermPolicyNotFoundException);
        });

        it('throws TermPolicyStatusInvalidException for a published policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...draft,
                status: EnumTermPolicyStatus.published,
            });

            await expect(
                service['findOneDraftById']('term-id')
            ).rejects.toBeInstanceOf(TermPolicyStatusInvalidException);
        });
    });

    describe('wrapError', () => {
        it('returns a typed exception unchanged', () => {
            const exception = new TermPolicyContentExistException();

            expect(service['wrapError'](exception)).toBe(exception);
        });

        it('wraps any other error into AppUnknownException', () => {
            const error = new Error('db');

            const result = service['wrapError'](error);

            expect(result).toBeInstanceOf(AppUnknownException);
            expect(result.rawError).toBe(error);
        });
    });
});
