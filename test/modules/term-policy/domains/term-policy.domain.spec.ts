import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock, mockDeep } from 'vitest-mock-extended';
import type { DeepMockProxy, MockProxy } from 'vitest-mock-extended';
import { AppUnknownException } from '@app/exceptions/app.unknown.exception';
import { EnumAppStatusCodeError } from '@app/enums/app.status-code.enum';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { DatabaseService } from '@common/database/services/database.service';
import { DatabaseUtil } from '@common/database/utils/database.util';
import type { IDatabaseTransactionClient } from '@common/database/interfaces/database.client.interface';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { EnumPaginationType } from '@common/pagination/enums/pagination.enum';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageKeyInvalidException } from '@common/storage/exceptions/storage.key-invalid.exception';
import {
    EnumActivityLogAction,
    EnumStorageVisibility,
    EnumTermPolicyStatus,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import type {
    TermPolicy,
    TermPolicyContent,
} from '@generated/prisma-client/client';
import { ActivityLogDomain } from '@modules/activity-log/domains/activity-log.domain';
import type { IActivityLogStagedEvent } from '@modules/activity-log/interfaces/activity-log.interface';
import { NotificationQueue } from '@modules/notification/queues/notification.queue';
import { UserDomain } from '@modules/user/domains/user.domain';
import { TermPolicyContentType } from '@modules/term-policy/constants/term-policy.constant';
import { TermPolicyContentEmptyException } from '@modules/term-policy/exceptions/term-policy.content-empty.exception';
import { TermPolicyExistException } from '@modules/term-policy/exceptions/term-policy.exist.exception';
import { TermPolicyLanguageDuplicateException } from '@modules/term-policy/exceptions/term-policy.language-duplicate.exception';
import { TermPolicyNotFoundException } from '@modules/term-policy/exceptions/term-policy.not-found.exception';
import { TermPolicyStatusInvalidException } from '@modules/term-policy/exceptions/term-policy.status-invalid.exception';
import type {
    ITermPolicy,
    ITermPolicyContentCreate,
} from '@modules/term-policy/interfaces/term-policy.interface';
import { TermPolicyRepository } from '@modules/term-policy/repositories/term-policy.repository';
import { TermPolicyContentDomain } from '@modules/term-policy/domains/term-policy.content.domain';
import { TermPolicyDomain } from '@modules/term-policy/domains/term-policy.domain';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';

describe('TermPolicyDomain', () => {
    const termPolicyRepository: MockProxy<TermPolicyRepository> =
        mock<TermPolicyRepository>();
    const objectStorageService: MockProxy<ObjectStorageService> =
        mock<ObjectStorageService>();
    const termPolicyUtil: MockProxy<TermPolicyUtil> = mock<TermPolicyUtil>();
    const termPolicyContentDomain: MockProxy<TermPolicyContentDomain> =
        mock<TermPolicyContentDomain>();
    const notificationQueue: MockProxy<NotificationQueue> =
        mock<NotificationQueue>();
    const activityLogDomain: MockProxy<ActivityLogDomain> =
        mock<ActivityLogDomain>();
    const databaseService: DeepMockProxy<DatabaseService> =
        mockDeep<DatabaseService>();
    const userDomain: MockProxy<UserDomain> = mock<UserDomain>();
    const databaseUtil: MockProxy<DatabaseUtil> = mock<DatabaseUtil>();
    const helperDateService: MockProxy<HelperDateService> =
        mock<HelperDateService>();

    const now = new Date('2026-01-01T00:00:00.000Z');
    const preparedEvent: IActivityLogStagedEvent = {
        action: EnumActivityLogAction.adminTermPolicyPublish,
        metadata: {},
        onError: false,
    };
    const contentEn: TermPolicyContent = {
        id: 'content-en',
        termPolicyId: 'term-id',
        language: EnumMessageLanguage.en,
        key: 'term-policies/privacy/v1/en/draft.hbs',
        visibility: EnumStorageVisibility.private,
        contentType: TermPolicyContentType,
        size: BigInt(100),
        etag: null,
    };
    const contentSecond: TermPolicyContent = {
        ...contentEn,
        id: 'content-second',
        key: 'term-policies/privacy/v1/en/second.hbs',
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
        contents: [contentEn, contentSecond],
    };
    const published: TermPolicy = {
        id: 'term-id',
        type: EnumTermPolicyType.privacy,
        version: 1,
        status: EnumTermPolicyStatus.published,
        publishedAt: now,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
    };
    const tx = mock<IDatabaseTransactionClient>();

    let service: TermPolicyDomain;

    beforeEach(async () => {
        vi.resetAllMocks();
        databaseUtil.createId.mockReturnValue('new-term-id');
        helperDateService.create.mockReturnValue(now);
        databaseService.withTransaction.mockImplementation(async callback =>
            callback(tx)
        );
        activityLogDomain.prepare.mockReturnValue(preparedEvent);
        termPolicyUtil.mapActivityLogMetadata.mockReturnValue({});
        termPolicyUtil.getDraftPrefix.mockReturnValue(
            'term-policies/privacy/v1/'
        );
        termPolicyUtil.getContentScopePrefix.mockReturnValue(
            'term-policies/privacy/v1/en/'
        );
        termPolicyUtil.validateUniqueLanguages.mockReturnValue(true);
        termPolicyRepository.findOneById.mockResolvedValue(draft);
        termPolicyRepository.existsByVersionAndType.mockResolvedValue(false);
        termPolicyRepository.publishInTx.mockResolvedValue(published);
        termPolicyContentDomain.sweepContentScope.mockResolvedValue();

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyDomain,
                {
                    provide: TermPolicyRepository,
                    useValue: termPolicyRepository,
                },
                {
                    provide: ObjectStorageService,
                    useValue: objectStorageService,
                },
                { provide: TermPolicyUtil, useValue: termPolicyUtil },
                {
                    provide: TermPolicyContentDomain,
                    useValue: termPolicyContentDomain,
                },
                { provide: NotificationQueue, useValue: notificationQueue },
                { provide: ActivityLogDomain, useValue: activityLogDomain },
                { provide: DatabaseService, useValue: databaseService },
                { provide: UserDomain, useValue: userDomain },
                { provide: DatabaseUtil, useValue: databaseUtil },
                { provide: HelperDateService, useValue: helperDateService },
            ],
        }).compile();
        service = moduleRef.get(TermPolicyDomain);
    });

    describe('getListByAdmin', () => {
        it('delegates the admin list to the repository', async () => {
            const page = {
                type: EnumPaginationType.offset as const,
                count: 0,
                perPage: 10,
                page: 1,
                totalPage: 0,
                hasNext: false,
                hasPrevious: false,
                data: [],
            };
            termPolicyRepository.find.mockResolvedValue(page);

            const result = await service.getListByAdmin({
                limit: 10,
                skip: 0,
                orderBy: [],
            });

            expect(result).toBe(page);
        });
    });

    describe('getListPublished', () => {
        it('delegates the published list to the repository', async () => {
            const page = {
                type: EnumPaginationType.cursor as const,
                perPage: 10,
                hasNext: false,
                data: [],
            };
            termPolicyRepository.findPublished.mockResolvedValue(page);

            const result = await service.getListPublished({
                limit: 10,
                orderBy: [],
            });

            expect(result).toBe(page);
        });
    });

    describe('createByAdmin', () => {
        const uploads = [
            {
                language: EnumMessageLanguage.en,
                key: 'term-policies/privacy/v1/en/uploaded.hbs',
            },
        ];
        const promotedContent: ITermPolicyContentCreate = {
            key: 'term-policies/privacy/v1/en/final.hbs',
            visibility: EnumStorageVisibility.private,
            contentType: TermPolicyContentType,
            size: 100,
            etag: null,
            language: EnumMessageLanguage.en,
        };

        beforeEach(() => {
            termPolicyContentDomain.verifyContent.mockResolvedValue(
                promotedContent
            );
            termPolicyRepository.create.mockResolvedValue(published);
        });

        it('throws TermPolicyExistException without verifying for a duplicate type and version', async () => {
            termPolicyRepository.existsByVersionAndType.mockResolvedValue(true);

            await expect(
                service.createByAdmin({
                    contents: uploads,
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                })
            ).rejects.toBeInstanceOf(TermPolicyExistException);
            expect(
                termPolicyContentDomain.verifyContent
            ).not.toHaveBeenCalled();
        });

        it('throws TermPolicyLanguageDuplicateException without verifying for duplicate languages', async () => {
            termPolicyUtil.validateUniqueLanguages.mockReturnValue(false);

            await expect(
                service.createByAdmin({
                    contents: uploads,
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                })
            ).rejects.toBeInstanceOf(TermPolicyLanguageDuplicateException);
            expect(
                termPolicyContentDomain.verifyContent
            ).not.toHaveBeenCalled();
        });

        it('verifies every uploaded object and creates the draft without copying', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.create.mockImplementation(async () => {
                callOrder.push('create');
                return published;
            });
            termPolicyContentDomain.sweepContentScope.mockImplementation(
                async () => {
                    callOrder.push('sweep');
                }
            );

            const result = await service.createByAdmin({
                contents: uploads,
                type: EnumTermPolicyType.privacy,
                version: 1,
            });

            expect(termPolicyContentDomain.verifyContent).toHaveBeenCalledWith(
                { type: EnumTermPolicyType.privacy, version: 1 },
                uploads[0]
            );
            expect(termPolicyRepository.create).toHaveBeenCalledWith(
                'new-term-id',
                {
                    contents: uploads,
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                },
                [promotedContent]
            );
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(
                termPolicyContentDomain.sweepContentScope
            ).toHaveBeenCalledWith(
                published.id,
                { type: EnumTermPolicyType.privacy, version: 1 },
                EnumMessageLanguage.en
            );
            expect(callOrder).toEqual(['create', 'sweep']);
            expect(activityLogDomain.prepare).toHaveBeenCalledWith({
                action: EnumActivityLogAction.adminTermPolicyCreate,
                metadata: {},
            });
            expect(result).toBe(published);
        });

        it('writes nothing and deletes nothing when one uploaded content is rejected', async () => {
            const exception = new StorageKeyInvalidException();
            termPolicyContentDomain.verifyContent
                .mockResolvedValueOnce(promotedContent)
                .mockRejectedValueOnce(exception);

            await expect(
                service.createByAdmin({
                    contents: [
                        ...uploads,
                        {
                            language: EnumMessageLanguage.en,
                            key: 'term-policies/other/v1/en/foreign.hbs',
                        },
                    ],
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                })
            ).rejects.toBe(exception);
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(
                termPolicyContentDomain.sweepContentScope
            ).not.toHaveBeenCalled();
            expect(termPolicyRepository.create).not.toHaveBeenCalled();
        });

        it('rethrows a verification failure unchanged and deletes no verified sibling', async () => {
            const sibling: ITermPolicyContentCreate = {
                ...promotedContent,
                key: 'term-policies/privacy/v1/en/sibling.hbs',
            };
            const first = new StorageKeyInvalidException();
            termPolicyContentDomain.verifyContent
                .mockRejectedValueOnce(first)
                .mockResolvedValueOnce(sibling);

            await expect(
                service.createByAdmin({
                    contents: [
                        ...uploads,
                        { language: EnumMessageLanguage.en, key: sibling.key },
                    ],
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                })
            ).rejects.toBe(first);
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(termPolicyRepository.create).not.toHaveBeenCalled();
        });

        it('deletes nothing, sweeps nothing and rethrows as AppUnknownException when the database write fails', async () => {
            termPolicyRepository.create.mockRejectedValue(new Error('db'));

            await expect(
                service.createByAdmin({
                    contents: uploads,
                    type: EnumTermPolicyType.privacy,
                    version: 1,
                })
            ).rejects.toMatchObject({
                module: 'app',
                statusCode: EnumAppStatusCodeError.unknown,
            });
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(
                termPolicyContentDomain.sweepContentScope
            ).not.toHaveBeenCalled();
            expect(activityLogDomain.stagePrepared).not.toHaveBeenCalled();
        });
    });

    describe('deleteByAdmin', () => {
        it('throws TermPolicyNotFoundException for an unknown policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(null);

            await expect(
                service.deleteByAdmin('missing')
            ).rejects.toBeInstanceOf(TermPolicyNotFoundException);
        });

        it('throws TermPolicyStatusInvalidException for a published policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...draft,
                status: EnumTermPolicyStatus.published,
            });

            await expect(
                service.deleteByAdmin(draft.id)
            ).rejects.toBeInstanceOf(TermPolicyStatusInvalidException);
            expect(termPolicyRepository.delete).not.toHaveBeenCalled();
        });

        it('deletes the aggregate first, then public objects under the draft prefix', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.delete.mockImplementation(async () => {
                callOrder.push('delete');
                return published;
            });
            objectStorageService.deletePrefix.mockImplementation(async () => {
                callOrder.push('deletePrefix');
            });

            const result = await service.deleteByAdmin(draft.id);

            expect(termPolicyUtil.getDraftPrefix).toHaveBeenCalledWith(draft);
            expect(objectStorageService.deletePrefix).toHaveBeenCalledWith(
                EnumStorageVisibility.public,
                'term-policies/privacy/v1/'
            );
            expect(callOrder).toEqual(['delete', 'deletePrefix']);
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledOnce();
            expect(result).toBe(published);
        });

        it('resolves when the prefix delete fails after the aggregate is gone', async () => {
            termPolicyRepository.delete.mockResolvedValue(published);
            objectStorageService.deletePrefix.mockRejectedValue(
                new Error('down')
            );

            await expect(service.deleteByAdmin(draft.id)).resolves.toBe(
                published
            );
        });

        it('keeps the objects and rethrows as AppUnknownException when the aggregate delete fails', async () => {
            termPolicyRepository.delete.mockRejectedValue(new Error('db'));

            await expect(
                service.deleteByAdmin(draft.id)
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(objectStorageService.deletePrefix).not.toHaveBeenCalled();
        });
    });

    describe('publishByAdmin', () => {
        it('throws TermPolicyNotFoundException for an unknown policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue(null);

            await expect(
                service.publishByAdmin('missing', 'admin-id')
            ).rejects.toBeInstanceOf(TermPolicyNotFoundException);
        });

        it('throws TermPolicyStatusInvalidException for an already published policy', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...draft,
                status: EnumTermPolicyStatus.published,
            });

            await expect(
                service.publishByAdmin(draft.id, 'admin-id')
            ).rejects.toBeInstanceOf(TermPolicyStatusInvalidException);
        });

        it('throws TermPolicyContentEmptyException without copying for a draft with no content', async () => {
            termPolicyRepository.findOneById.mockResolvedValue({
                ...draft,
                contents: [],
            });

            await expect(
                service.publishByAdmin(draft.id, 'admin-id')
            ).rejects.toBeInstanceOf(TermPolicyContentEmptyException);
        });

        it('publishes existing content without copying and resets acceptance', async () => {
            await service.publishByAdmin(draft.id, 'admin-id');
            expect(termPolicyRepository.publishInTx).toHaveBeenCalledWith(
                tx,
                draft.id
            );
            expect(
                userDomain.resetTermPolicyForActiveUsersInTx
            ).toHaveBeenCalledWith(tx, EnumTermPolicyType.privacy);
        });

        it('keeps the objects and sends the notification after commit', async () => {
            const callOrder: string[] = [];
            termPolicyRepository.publishInTx.mockImplementation(async () => {
                callOrder.push('publish');
                return published;
            });
            notificationQueue.sendPublishTermPolicy.mockImplementation(
                async () => {
                    callOrder.push('notify');
                }
            );

            await service.publishByAdmin(draft.id, 'admin-id');

            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(activityLogDomain.stagePrepared).toHaveBeenCalledWith([
                preparedEvent,
            ]);
            expect(
                notificationQueue.sendPublishTermPolicy
            ).toHaveBeenCalledWith(
                { type: EnumTermPolicyType.privacy, version: 1 },
                'admin-id'
            );
            expect(callOrder).toEqual(['publish', 'notify']);
        });

        it('keeps the objects when the transaction rejects', async () => {
            termPolicyRepository.publishInTx.mockRejectedValue(new Error('db'));

            await expect(
                service.publishByAdmin(draft.id, 'admin-id')
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(objectStorageService.deleteQuietly).not.toHaveBeenCalled();
            expect(
                notificationQueue.sendPublishTermPolicy
            ).not.toHaveBeenCalled();
        });

        it('rethrows a notification failure as AppUnknownException after the commit', async () => {
            notificationQueue.sendPublishTermPolicy.mockRejectedValue(
                new Error('queue down')
            );

            await expect(
                service.publishByAdmin(draft.id, 'admin-id')
            ).rejects.toBeInstanceOf(AppUnknownException);
            expect(termPolicyRepository.publishInTx).toHaveBeenCalled();
        });
    });

    describe('prepareActivityLog', () => {
        it('prepares the action with the policy metadata', () => {
            const result = service['prepareActivityLog'](
                EnumActivityLogAction.adminTermPolicyDelete,
                draft,
                now
            );

            expect(termPolicyUtil.mapActivityLogMetadata).toHaveBeenCalledWith(
                draft,
                now
            );
            expect(result).toBe(preparedEvent);
        });
    });

    describe('wrapError', () => {
        it('returns a typed exception unchanged', () => {
            const exception = new TermPolicyNotFoundException();

            expect(service['wrapError'](exception)).toBe(exception);
        });

        it('wraps any other error into AppUnknownException', () => {
            const result = service['wrapError'](new Error('db'));

            expect(result).toBeInstanceOf(AppUnknownException);
        });
    });

    describe('deletePrefixQuietly', () => {
        it('deletes every public object under the prefix', async () => {
            await service['deletePrefixQuietly']('term-policies/privacy/v1/');

            expect(objectStorageService.deletePrefix).toHaveBeenCalledWith(
                EnumStorageVisibility.public,
                'term-policies/privacy/v1/'
            );
        });

        it('swallows a prefix delete failure', async () => {
            objectStorageService.deletePrefix.mockRejectedValue(
                new Error('down')
            );

            await expect(
                service['deletePrefixQuietly']('term-policies/privacy/v1/')
            ).resolves.toBeUndefined();
        });
    });
});
