import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperArrayService } from '@common/helper/services/helper.array.service';
import type {
    Notification,
    NotificationUserSetting,
    User,
} from '@generated/prisma-client/client';
import {
    EnumNotificationChannel,
    EnumNotificationPriority,
    EnumNotificationType,
    EnumTermPolicyType,
    EnumUserGender,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumUserSignUpFrom,
    EnumUserSignUpWith,
    EnumUserStatus,
} from '@generated/prisma-client/client';
import { NotificationTermPolicyDomain } from '@modules/notification/domains/notification.term-policy.domain';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import { NotificationEmailQueue } from '@modules/notification/queues/notification.email.queue';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { NotificationUserSettingRepository } from '@modules/notification/repositories/notification.user-setting.repository';
import { UserDomain } from '@modules/user/domains/user.domain';

describe('NotificationTermPolicyDomain', () => {
    const notificationRepository = mock<NotificationRepository>();
    const notificationUserSettingRepository =
        mock<NotificationUserSettingRepository>();
    const userDomain = mock<UserDomain>();
    const configService = mock<ConfigService>();
    const helperArrayService = mock<HelperArrayService>();
    const databaseUtil = mock<DatabaseUtil>();
    const notificationEmailQueue = mock<NotificationEmailQueue>();
    let domain: NotificationTermPolicyDomain;

    const user: User = {
        id: 'user-1',
        name: 'Nadia Bloom',
        username: 'nadia',
        isVerified: true,
        verifiedAt: new Date('2024-01-01T00:00:00.000Z'),
        email: 'nadia@example.com',
        roleId: 'role-id',
        password: 'hashed',
        passwordExpired: null,
        passwordCreated: null,
        passwordAttempt: 0,
        signUpAt: new Date('2024-01-01T00:00:00.000Z'),
        signUpFrom: EnumUserSignUpFrom.website,
        signUpWith: EnumUserSignUpWith.credential,
        status: EnumUserStatus.active,
        gender: EnumUserGender.female,
        countryId: 'country-id',
        lastLoginAt: null,
        lastIPAddress: null,
        lastLoginFrom: EnumUserLoginFrom.website,
        lastLoginWith: EnumUserLoginWith.credential,
        lastWorkspaceId: null,
        lastWorkspaceChangedAt: null,
        termPolicy: {
            termsOfService: true,
            privacy: true,
            marketing: false,
            cookies: true,
        },
        photo: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        createdBy: null,
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
    };
    const data = { type: EnumTermPolicyType.privacy, version: 2 };
    const notification: Notification = {
        id: 'notification-id',
        userId: user.id,
        type: EnumNotificationType.transactional,
        priority: EnumNotificationPriority.normal,
        title: 'Term policy published',
        body: 'A term policy was published',
        metadata: null,
        isRead: false,
        readAt: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        createdBy: 'admin-id',
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedBy: null,
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values: Record<string, number> = { 'email.batchSize': 1 };

            return values[key];
        });
        const module = await Test.createTestingModule({
            providers: [
                NotificationTermPolicyDomain,
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                {
                    provide: NotificationUserSettingRepository,
                    useValue: notificationUserSettingRepository,
                },
                { provide: UserDomain, useValue: userDomain },
                { provide: ConfigService, useValue: configService },
                {
                    provide: HelperArrayService,
                    useValue: helperArrayService,
                },
                { provide: DatabaseUtil, useValue: databaseUtil },
                {
                    provide: NotificationEmailQueue,
                    useValue: notificationEmailQueue,
                },
            ],
        }).compile();
        domain = module.get(NotificationTermPolicyDomain);
    });

    describe('processPublishTermPolicy', () => {
        it('reports zero batches when no active user has an active transactional email setting', async () => {
            userDomain.getListActive.mockResolvedValue([
                { id: user.id, email: user.email, username: user.username },
            ]);
            notificationUserSettingRepository.findActiveUserSettingByType.mockResolvedValue(
                []
            );

            const result = await domain.processPublishTermPolicy(
                'admin-id',
                data
            );

            expect(result).toEqual({
                message: 'No users to send publish term policy notification',
                userCounts: 1,
                filteredUserCounts: 0,
                batches: 0,
            });
            expect(notificationRepository.createMany).not.toHaveBeenCalled();
        });

        it('chunks the filtered users and writes plus enqueues one batch per chunk', async () => {
            userDomain.getListActive.mockResolvedValue([
                { id: user.id, email: user.email, username: user.username },
            ]);
            const setting: NotificationUserSetting = {
                id: 'setting-id',
                userId: user.id,
                channel: EnumNotificationChannel.email,
                type: EnumNotificationType.transactional,
                isActive: true,
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
                createdBy: null,
                updatedAt: new Date('2024-01-01T00:00:00.000Z'),
                updatedBy: null,
            };
            notificationUserSettingRepository.findActiveUserSettingByType.mockResolvedValue(
                [setting]
            );
            helperArrayService.chunk.mockReturnValue([
                [{ id: user.id, email: user.email, username: user.username }],
            ]);
            databaseUtil.createId.mockReturnValue('notification-id');
            notificationRepository.createMany.mockResolvedValue([notification]);
            notificationEmailQueue.sendPublishTermPolicy.mockResolvedValue(
                undefined
            );

            const result = await domain.processPublishTermPolicy(
                'admin-id',
                data
            );

            expect(
                notificationUserSettingRepository.findActiveUserSettingByType
            ).toHaveBeenCalledWith(
                [user.id],
                EnumNotificationType.transactional,
                [EnumNotificationChannel.email]
            );
            expect(notificationRepository.createMany).toHaveBeenCalledWith([
                {
                    kind: EnumNotificationKind.publishTermPolicy,
                    payload: {
                        id: 'notification-id',
                        userId: user.id,
                        metadata: { type: data.type, version: data.version },
                        createdBy: 'admin-id',
                    },
                },
            ]);
            expect(
                notificationEmailQueue.sendPublishTermPolicy
            ).toHaveBeenCalledWith(
                [
                    {
                        userId: user.id,
                        email: user.email,
                        username: user.username,
                        notificationId: 'notification-id',
                    },
                ],
                data,
                0
            );
            expect(result).toEqual({
                message: 'Publish term policy notification processed',
                userCounts: 1,
                filteredUserCounts: 1,
                batches: 1,
            });
        });

        it('creates the rows before enqueueing each chunk', async () => {
            const other = {
                id: 'user-2',
                email: 'omar@example.com',
                username: 'omar',
            };
            const contact = {
                id: user.id,
                email: user.email,
                username: user.username,
            };
            userDomain.getListActive.mockResolvedValue([contact, other]);
            const setting: NotificationUserSetting = {
                id: 'setting-id',
                userId: user.id,
                channel: EnumNotificationChannel.email,
                type: EnumNotificationType.transactional,
                isActive: true,
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
                createdBy: null,
                updatedAt: new Date('2024-01-01T00:00:00.000Z'),
                updatedBy: null,
            };
            notificationUserSettingRepository.findActiveUserSettingByType.mockResolvedValue(
                [setting, { ...setting, id: 'setting-2', userId: other.id }]
            );
            helperArrayService.chunk.mockReturnValue([[contact], [other]]);
            databaseUtil.createId
                .mockReturnValueOnce('notification-1')
                .mockReturnValueOnce('notification-2');
            const calls: string[] = [];
            notificationRepository.createMany.mockImplementation(
                async entries => {
                    calls.push(`create-${entries[0].payload.id}`);

                    return [notification];
                }
            );
            notificationEmailQueue.sendPublishTermPolicy.mockImplementation(
                async (_send, _data, chunkIndex) => {
                    calls.push(`enqueue-${chunkIndex}`);
                }
            );

            await domain.processPublishTermPolicy('admin-id', data);

            expect(calls).toEqual([
                'create-notification-1',
                'enqueue-0',
                'create-notification-2',
                'enqueue-1',
            ]);
            expect(
                notificationEmailQueue.sendPublishTermPolicy
            ).toHaveBeenNthCalledWith(
                2,
                [
                    {
                        userId: other.id,
                        email: other.email,
                        username: other.username,
                        notificationId: 'notification-2',
                    },
                ],
                data,
                1
            );
        });

        it('does not enqueue a chunk whose rows failed to write', async () => {
            const contact = {
                id: user.id,
                email: user.email,
                username: user.username,
            };
            userDomain.getListActive.mockResolvedValue([contact]);
            notificationUserSettingRepository.findActiveUserSettingByType.mockResolvedValue(
                [
                    {
                        id: 'setting-id',
                        userId: user.id,
                        channel: EnumNotificationChannel.email,
                        type: EnumNotificationType.transactional,
                        isActive: true,
                        createdAt: new Date('2024-01-01T00:00:00.000Z'),
                        createdBy: null,
                        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
                        updatedBy: null,
                    },
                ]
            );
            helperArrayService.chunk.mockReturnValue([[contact]]);
            databaseUtil.createId.mockReturnValue('notification-id');
            const error = new Error('write failed');
            notificationRepository.createMany.mockRejectedValue(error);

            await expect(
                domain.processPublishTermPolicy('admin-id', data)
            ).rejects.toBe(error);

            expect(
                notificationEmailQueue.sendPublishTermPolicy
            ).not.toHaveBeenCalled();
        });
    });

    describe('processUserAcceptTermPolicy', () => {
        const acceptData = { ...data, termPolicyId: 'term-policy-id' };

        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);

            const result = await domain.processUserAcceptTermPolicy(
                'user-id',
                acceptData
            );

            expect(result).toEqual({
                message:
                    'User not found, skipping user accept term policy notification',
            });
            expect(notificationRepository.create).not.toHaveBeenCalled();
        });

        it('writes the notification for an active user', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            databaseUtil.createId.mockReturnValue('notification-id');
            notificationRepository.create.mockResolvedValue(notification);

            const result = await domain.processUserAcceptTermPolicy(
                'user-id',
                acceptData
            );

            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.userAcceptTermPolicy,
                {
                    id: 'notification-id',
                    userId: user.id,
                    metadata: {
                        username: user.username,
                        type: acceptData.type,
                        version: acceptData.version,
                    },
                    createdBy: user.id,
                }
            );
            expect(result).toEqual({
                message: 'User accept term policy notification processed',
            });
        });
    });
});
