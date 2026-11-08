import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { DatabaseUtil } from '@common/database/utils/database.util';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { RequestContextService } from '@common/request/services/request.context.service';
import type { IRequestLog } from '@common/request/interfaces/request.interface';
import type { Notification, User } from '@generated/prisma-client/client';
import {
    EnumDeviceNotificationProvider,
    EnumDevicePlatform,
    EnumNotificationChannel,
    EnumNotificationPriority,
    EnumNotificationType,
    EnumUserGender,
    EnumUserLoginFrom,
    EnumUserLoginWith,
    EnumUserSignUpFrom,
    EnumUserSignUpWith,
    EnumUserStatus,
} from '@generated/prisma-client/client';
import { DeviceDomain } from '@modules/device/domains/device.domain';
import { NotificationKindContract } from '@modules/notification/contracts/notification.kind.contract';
import type { IDeviceOwnershipWithDevice } from '@modules/device/interfaces/device.interface';
import { NotificationSecurityDomain } from '@modules/notification/domains/notification.security.domain';
import { EnumNotificationKind } from '@modules/notification/enums/notification.enum';
import type { INotificationNewDeviceLoginPayload } from '@modules/notification/interfaces/notification.interface';
import { NotificationEmailQueue } from '@modules/notification/queues/notification.email.queue';
import { NotificationPushQueue } from '@modules/notification/queues/notification.push.queue';
import { NotificationSmsQueue } from '@modules/notification/queues/notification.sms.queue';
import { NotificationRepository } from '@modules/notification/repositories/notification.repository';
import { UserDomain } from '@modules/user/domains/user.domain';
import { UserMobileNumberDomain } from '@modules/user/domains/user.mobile-number.domain';

describe('NotificationSecurityDomain', () => {
    const notificationRepository = mock<NotificationRepository>();
    const userDomain = mock<UserDomain>();
    const deviceDomain = mock<DeviceDomain>();
    const helperDateService = mock<HelperDateService>();
    const requestContextService = mock<RequestContextService>();
    const databaseUtil = mock<DatabaseUtil>();
    const notificationEmailQueue = mock<NotificationEmailQueue>();
    const notificationPushQueue = mock<NotificationPushQueue>();
    const userMobileNumberDomain = {
        getVerifiedByUserId: vi.fn().mockResolvedValue([]),
    };
    const notificationSmsQueue = mock<NotificationSmsQueue>();
    let domain: NotificationSecurityDomain;

    const user: User = {
        id: 'user-id',
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

    const deviceOwnership: IDeviceOwnershipWithDevice = {
        id: 'ownership-id',
        deviceId: 'device-id',
        userId: 'user-id',
        revokedAt: null,
        isRevoked: false,
        revokedById: null,
        lastActiveAt: new Date('2024-01-01T00:00:00.000Z'),
        biometricEnabled: false,
        biometricToken: null,
        biometricType: null,
        biometricEnabledAt: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        createdBy: null,
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedBy: null,
        device: {
            id: 'device-id',
            fingerprint: 'fingerprint-1',
            name: 'iPhone',
            platform: EnumDevicePlatform.ios,
            lastActiveAt: new Date('2024-01-01T00:00:00.000Z'),
            notificationToken: 'push-token',
            notificationProvider: EnumDeviceNotificationProvider.fcm,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            createdBy: null,
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedBy: null,
        },
    };

    const notification: Notification = {
        id: 'notification-id',
        userId: 'user-id',
        type: EnumNotificationType.securityAlert,
        priority: EnumNotificationPriority.high,
        title: 'Security alert',
        body: 'A new device signed in',
        metadata: null,
        isRead: false,
        readAt: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        createdBy: null,
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedBy: null,
    };

    const mobileNumber = {
        phoneCode: '62',
        number: '8123456789',
    };

    it('does not query mobile numbers for the original email/push channel lists', async () => {
        await domain.processChangePassword(user.id);
        expect(
            userMobileNumberDomain.getVerifiedByUserId
        ).not.toHaveBeenCalled();
        expect(notificationSmsQueue.sendSecurityAlert).not.toHaveBeenCalled();
    });

    beforeEach(async () => {
        vi.resetAllMocks();
        databaseUtil.createId.mockReturnValue('notification-id');
        userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([]);
        const module = await Test.createTestingModule({
            providers: [
                NotificationSecurityDomain,
                {
                    provide: NotificationRepository,
                    useValue: notificationRepository,
                },
                { provide: UserDomain, useValue: userDomain },
                { provide: DeviceDomain, useValue: deviceDomain },
                { provide: HelperDateService, useValue: helperDateService },
                {
                    provide: RequestContextService,
                    useValue: requestContextService,
                },
                { provide: DatabaseUtil, useValue: databaseUtil },
                {
                    provide: NotificationEmailQueue,
                    useValue: notificationEmailQueue,
                },
                {
                    provide: NotificationPushQueue,
                    useValue: notificationPushQueue,
                },
                {
                    provide: UserMobileNumberDomain,
                    useValue: userMobileNumberDomain,
                },
                {
                    provide: NotificationSmsQueue,
                    useValue: notificationSmsQueue,
                },
            ],
        }).compile();
        domain = module.get(NotificationSecurityDomain);
    });

    describe('processTemporaryPasswordByAdmin', () => {
        const data = {
            encryptedPassword: 'cipher',
            passwordExpiredAt: '2024-02-01T00:00:00.000Z',
            passwordCreatedAt: '2024-01-01T00:00:00.000Z',
        };

        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            helperDateService.createFromIso.mockReturnValue(new Date());

            const result = await domain.processTemporaryPasswordByAdmin(
                'user-id',
                'admin-id',
                data
            );

            expect(result).toEqual({
                message:
                    'User not found, skipping temporary password by admin notification',
            });
            expect(notificationRepository.create).not.toHaveBeenCalled();
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processTemporaryPasswordByAdmin(
                    'user-id',
                    'admin-id',
                    data
                )
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendTemporaryPasswordByAdmin
            ).not.toHaveBeenCalled();
            expect(
                notificationPushQueue.sendTemporaryPasswordByAdmin
            ).not.toHaveBeenCalled();
        });

        it('marks push skipped when the user has no device tokens', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendTemporaryPasswordByAdmin.mockResolvedValue(
                undefined
            );

            await domain.processTemporaryPasswordByAdmin(
                'user-id',
                'admin-id',
                data
            );

            expect(
                notificationPushQueue.sendTemporaryPasswordByAdmin
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push,
                []
            );
        });

        it('writes the notification and enqueues email and push when a device has a token', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendTemporaryPasswordByAdmin.mockResolvedValue(
                undefined
            );
            notificationPushQueue.sendTemporaryPasswordByAdmin.mockResolvedValue(
                undefined
            );

            const result = await domain.processTemporaryPasswordByAdmin(
                'user-id',
                'admin-id',
                data
            );

            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.temporaryPasswordByAdmin,
                expect.objectContaining({
                    id: 'notification-id',
                    userId: user.id,
                    createdBy: 'admin-id',
                })
            );
            expect(
                notificationEmailQueue.sendTemporaryPasswordByAdmin
            ).toHaveBeenCalledWith(
                {
                    userId: user.id,
                    email: user.email,
                    username: user.username,
                    notificationId: 'notification-id',
                },
                data
            );
            expect(
                notificationPushQueue.sendTemporaryPasswordByAdmin
            ).toHaveBeenCalledWith(
                {
                    userId: 'user-id',
                    notificationId: 'notification-id',
                    notificationTokens: ['push-token'],
                    username: user.username,
                },
                {
                    passwordCreatedAt: data.passwordCreatedAt,
                    passwordExpiredAt: data.passwordExpiredAt,
                }
            );
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push
            );
            expect(result).toMatchObject({
                message: 'Temporary password by admin notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processTemporaryPasswordByAdmin(
                'user-id',
                'admin-id',
                data
            );

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processTemporaryPasswordByAdmin(
                'user-id',
                'admin-id',
                data
            );

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });

    describe('processChangePassword', () => {
        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);

            const result = await domain.processChangePassword('user-id');

            expect(result).toEqual({
                message:
                    'User not found, skipping change password notification',
            });
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processChangePassword('user-id')
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendChangePassword
            ).not.toHaveBeenCalled();
        });

        it('writes the notification and enqueues the email', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendChangePassword.mockResolvedValue(
                undefined
            );

            const result = await domain.processChangePassword('user-id');

            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.changePassword,
                {
                    id: 'notification-id',
                    userId: user.id,
                    metadata: { username: user.username },
                    createdBy: user.id,
                }
            );
            expect(
                notificationEmailQueue.sendChangePassword
            ).toHaveBeenCalledWith({
                userId: user.id,
                email: user.email,
                username: user.username,
                notificationId: 'notification-id',
            });
            expect(result).toMatchObject({
                message: 'Change password notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processChangePassword('user-id');

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processChangePassword('user-id');

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });

    describe('processForgotPassword', () => {
        const data = {
            expiredAt: '2024-02-01T00:00:00.000Z',
            encryptedLink: 'cipher-link',
            reference: 'ref-1',
            expiredInMinutes: 15,
            resendInMinutes: 5,
        };

        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);

            const result = await domain.processForgotPassword('user-id', data);

            expect(result).toEqual({
                message:
                    'User not found, skipping forgot password notification',
            });
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processForgotPassword('user-id', data)
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendForgotPassword
            ).not.toHaveBeenCalled();
        });

        it('keeps the original forgot-password channels and skips push without a handler', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendForgotPassword.mockResolvedValue(
                undefined
            );

            await domain.processForgotPassword('user-id', data);

            expect(
                NotificationKindContract[EnumNotificationKind.forgotPassword]
                    .pendingChannels
            ).toEqual([
                EnumNotificationChannel.email,
                EnumNotificationChannel.push,
            ]);
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push,
                []
            );
        });

        it('writes the notification and enqueues the email', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendForgotPassword.mockResolvedValue(
                undefined
            );

            const result = await domain.processForgotPassword('user-id', data);

            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.forgotPassword,
                {
                    id: 'notification-id',
                    userId: user.id,
                    metadata: { username: user.username },
                    createdBy: user.id,
                }
            );
            expect(
                notificationEmailQueue.sendForgotPassword
            ).toHaveBeenCalledWith(
                {
                    userId: user.id,
                    email: user.email,
                    username: user.username,
                    notificationId: 'notification-id',
                },
                data
            );
            expect(result).toMatchObject({
                message: 'Forgot password notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processForgotPassword('user-id', data);

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processForgotPassword('user-id', data);

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });

    describe('processResetPassword', () => {
        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );

            const result = await domain.processResetPassword('user-id');

            expect(result).toEqual({
                message: 'User not found, skipping reset password notification',
            });
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processResetPassword('user-id')
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendResetPassword
            ).not.toHaveBeenCalled();
            expect(
                notificationPushQueue.sendResetPassword
            ).not.toHaveBeenCalled();
        });

        it('marks push skipped when the user has no device tokens', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendResetPassword.mockResolvedValue(
                undefined
            );

            await domain.processResetPassword('user-id');

            expect(
                notificationPushQueue.sendResetPassword
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push,
                []
            );
        });

        it('enqueues exactly the channels in pendingChannels', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendResetPassword.mockResolvedValue(
                undefined
            );
            notificationPushQueue.sendResetPassword.mockResolvedValue(
                undefined
            );

            const result = await domain.processResetPassword('user-id');

            expect(
                notificationPushQueue.sendResetPassword
            ).toHaveBeenCalledWith({
                userId: 'user-id',
                notificationId: 'notification-id',
                notificationTokens: ['push-token'],
                username: user.username,
            });
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push
            );
            expect(result).toMatchObject({
                message: 'Reset password notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processResetPassword('user-id');

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processResetPassword('user-id');

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });

    describe('processResetTwoFactorByAdmin', () => {
        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );

            const result = await domain.processResetTwoFactorByAdmin(
                'user-id',
                'admin-id'
            );

            expect(result).toEqual({
                message:
                    'User not found, skipping reset two factor by admin notification',
            });
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processResetTwoFactorByAdmin('user-id', 'admin-id')
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendResetTwoFactorByAdmin
            ).not.toHaveBeenCalled();
            expect(
                notificationPushQueue.sendResetTwoFactorByAdmin
            ).not.toHaveBeenCalled();
        });

        it('marks push skipped when the user has no device tokens', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendResetTwoFactorByAdmin.mockResolvedValue(
                undefined
            );

            await domain.processResetTwoFactorByAdmin('user-id', 'admin-id');

            expect(
                notificationPushQueue.sendResetTwoFactorByAdmin
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push,
                []
            );
        });

        it('enqueues exactly the channels in pendingChannels', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendResetTwoFactorByAdmin.mockResolvedValue(
                undefined
            );
            notificationPushQueue.sendResetTwoFactorByAdmin.mockResolvedValue(
                undefined
            );

            const result = await domain.processResetTwoFactorByAdmin(
                'user-id',
                'admin-id'
            );

            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.resetTwoFactorByAdmin,
                {
                    id: 'notification-id',
                    userId: user.id,
                    metadata: { username: user.username },
                    createdBy: 'admin-id',
                }
            );
            expect(
                notificationPushQueue.sendResetTwoFactorByAdmin
            ).toHaveBeenCalledWith({
                userId: 'user-id',
                notificationId: 'notification-id',
                notificationTokens: ['push-token'],
                username: user.username,
            });
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push
            );
            expect(result).toMatchObject({
                message: 'Reset two factor by admin notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processResetTwoFactorByAdmin('user-id', 'admin-id');

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processResetTwoFactorByAdmin('user-id', 'admin-id');

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });

    describe('processNewDeviceLogin', () => {
        const requestLog: IRequestLog = {
            userAgent: {
                ua: 'Mozilla/5.0',
                browser: null,
                cpu: null,
                device: null,
                engine: null,
                os: null,
            },
            ipAddress: '203.0.113.5',
            geoLocation: {
                latitude: 1,
                longitude: 2,
                country: 'US',
                region: 'CA',
                city: 'San Francisco',
            },
        };
        const data: INotificationNewDeviceLoginPayload = {
            loginFrom: EnumUserLoginFrom.website,
            loginWith: EnumUserLoginWith.credential,
            loginAt: '2024-01-01T00:00:00.000Z',
            requestLog,
        };

        it('skips when the user is not active', async () => {
            userDomain.getOneActive.mockResolvedValue(null);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            requestContextService.resolveDevice.mockReturnValue('Chrome');
            requestContextService.resolveCity.mockReturnValue('SF');
            helperDateService.createFromIso.mockReturnValue(new Date());

            const result = await domain.processNewDeviceLogin('user-id', data);

            expect(result).toEqual({
                message:
                    'User not found, skipping new device login notification',
            });
        });

        it('creates the notification before enqueueing any channel', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            requestContextService.resolveDevice.mockReturnValue('Chrome');
            requestContextService.resolveCity.mockReturnValue('SF');
            helperDateService.createFromIso.mockReturnValue(new Date());
            notificationRepository.create.mockRejectedValue(
                new Error('write failed')
            );

            await expect(
                domain.processNewDeviceLogin('user-id', data)
            ).rejects.toThrow('write failed');
            expect(
                notificationEmailQueue.sendNewDeviceLogin
            ).not.toHaveBeenCalled();
            expect(
                notificationPushQueue.sendNewDeviceLogin
            ).not.toHaveBeenCalled();
        });

        it('marks push skipped when the user has no device tokens', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            requestContextService.resolveDevice.mockReturnValue('Chrome');
            requestContextService.resolveCity.mockReturnValue('SF');
            helperDateService.createFromIso.mockReturnValue(new Date());
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendNewDeviceLogin.mockResolvedValue(
                undefined
            );

            await domain.processNewDeviceLogin('user-id', data);

            expect(
                notificationPushQueue.sendNewDeviceLogin
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push,
                []
            );
        });

        it('resolves device and city, writes the notification, and enqueues email and push', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue([
                deviceOwnership,
            ]);
            requestContextService.resolveDevice.mockReturnValue(
                'Chrome on macOS'
            );
            requestContextService.resolveCity.mockReturnValue('San Francisco');
            helperDateService.createFromIso.mockImplementation(
                (iso: string) => new Date(iso)
            );
            notificationRepository.create.mockResolvedValue(notification);
            notificationEmailQueue.sendNewDeviceLogin.mockResolvedValue(
                undefined
            );
            notificationPushQueue.sendNewDeviceLogin.mockResolvedValue(
                undefined
            );

            const result = await domain.processNewDeviceLogin('user-id', data);

            expect(requestContextService.resolveDevice).toHaveBeenCalledWith(
                requestLog.userAgent
            );
            expect(requestContextService.resolveCity).toHaveBeenCalledWith(
                requestLog.geoLocation
            );
            expect(notificationRepository.create).toHaveBeenCalledWith(
                EnumNotificationKind.newDeviceLogin,
                {
                    id: 'notification-id',
                    userId: user.id,
                    metadata: {
                        username: user.username,
                        loginFrom: data.loginFrom,
                        loginWith: data.loginWith,
                        device: 'Chrome on macOS',
                        city: 'San Francisco',
                        loginAt: new Date(data.loginAt),
                    },
                    createdBy: user.id,
                }
            );
            expect(
                notificationEmailQueue.sendNewDeviceLogin
            ).toHaveBeenCalledWith(
                {
                    userId: user.id,
                    email: user.email,
                    username: user.username,
                    notificationId: 'notification-id',
                },
                data
            );
            expect(
                notificationPushQueue.sendNewDeviceLogin
            ).toHaveBeenCalledWith(
                {
                    userId: 'user-id',
                    notificationId: 'notification-id',
                    notificationTokens: ['push-token'],
                    username: user.username,
                },
                data
            );
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.push
            );
            expect(result).toMatchObject({
                message: 'New device login notification processed',
            });
        });

        it('does not enqueue sms when verified numbers exist', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            requestContextService.resolveDevice.mockReturnValue('Chrome');
            requestContextService.resolveCity.mockReturnValue('SF');
            helperDateService.createFromIso.mockReturnValue(new Date());
            userMobileNumberDomain.getVerifiedByUserId.mockResolvedValue([
                mobileNumber,
            ]);
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processNewDeviceLogin('user-id', data);

            expect(
                userMobileNumberDomain.getVerifiedByUserId
            ).not.toHaveBeenCalled();
            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });

        it('does not create an sms delivery when the user has no verified number', async () => {
            userDomain.getOneActive.mockResolvedValue(user);
            deviceDomain.getOwnershipsWithNotificationToken.mockResolvedValue(
                []
            );
            requestContextService.resolveDevice.mockReturnValue('Chrome');
            requestContextService.resolveCity.mockReturnValue('SF');
            helperDateService.createFromIso.mockReturnValue(new Date());
            notificationRepository.create.mockResolvedValue(notification);

            await domain.processNewDeviceLogin('user-id', data);

            expect(
                notificationSmsQueue.sendSecurityAlert
            ).not.toHaveBeenCalled();
            expect(notificationRepository.markSkipped).not.toHaveBeenCalledWith(
                user.id,
                'notification-id',
                EnumNotificationChannel.sms
            );
        });
    });
});
