import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import type { Messaging } from 'firebase-admin/messaging';
import type { App as FirebaseApp } from 'firebase-admin/app';
import type { FirebaseUtil } from '@common/firebase/utils/firebase.util';
import type { HelperArrayService } from '@common/helper/services/helper.array.service';
import { FirebaseMaxSendPushBatchSize } from '@common/firebase/constants/firebase.constant';
import type { IFirebasePushPayload } from '@common/firebase/interfaces/firebase.interface';

vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    cert: vi.fn(),
}));
vi.mock('firebase-admin/messaging', async importOriginal => ({
    ...(await importOriginal<typeof import('firebase-admin/messaging')>()),
    getMessaging: vi.fn(),
}));

describe('FirebaseService', () => {
    const configGet = vi.fn<(key: string) => string | null | undefined>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>({
        get: configGet as ConfigService['get'],
    });
    const firebaseUtil: MockProxy<FirebaseUtil> = mock<FirebaseUtil>();
    const helperArrayService: MockProxy<HelperArrayService> =
        mock<HelperArrayService>();

    let firebaseAdmin: typeof import('firebase-admin');
    let getMessaging: typeof import('firebase-admin/messaging').getMessaging;
    let FirebaseService: typeof import('@common/firebase/services/firebase.service').FirebaseService;
    let FirebaseUtilClass: typeof import('@common/firebase/utils/firebase.util').FirebaseUtil;
    let HelperArrayServiceClass: typeof import('@common/helper/services/helper.array.service').HelperArrayService;
    let FirebaseChunkSizeInvalidException: typeof import('@common/firebase/exceptions/firebase.chunk-size-invalid.exception').FirebaseChunkSizeInvalidException;

    let service: InstanceType<
        typeof import('@common/firebase/services/firebase.service').FirebaseService
    >;

    interface ICredentials {
        projectId: string | null;
        clientEmail: string | null;
        privateKey: string | null;
    }

    const build = async (
        credentials: ICredentials
    ): Promise<InstanceType<typeof FirebaseService>> => {
        configGet.mockImplementation((key: string) => {
            const values: Record<string, string | null> = {
                'firebase.projectId': credentials.projectId,
                'firebase.clientEmail': credentials.clientEmail,
                'firebase.privateKey': 'raw-private-key',
            };

            return values[key];
        });
        firebaseUtil.normalizePrivateKey.mockReturnValue(
            credentials.privateKey
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FirebaseService,
                { provide: ConfigService, useValue: configService },
                { provide: FirebaseUtilClass, useValue: firebaseUtil },
                {
                    provide: HelperArrayServiceClass,
                    useValue: helperArrayService,
                },
            ],
        }).compile();

        return module.get(FirebaseService);
    };

    const fullCredentials: ICredentials = {
        projectId: 'project-1',
        clientEmail: 'sa@project-1.iam.gserviceaccount.com',
        privateKey: 'normalized-private-key',
    };

    const payload: IFirebasePushPayload = {
        title: 'Title',
        body: 'Body',
        imageUrl: 'https://example.com/image.png',
        data: { key: 'value' },
    };

    const initialize = async (
        messagingImpl: MockProxy<Messaging>
    ): Promise<InstanceType<typeof FirebaseService>> => {
        const app = {} as FirebaseApp;
        vi.mocked(firebaseAdmin.cert).mockReturnValue('credential' as never);
        vi.mocked(firebaseAdmin.initializeApp).mockReturnValue(app);
        vi.mocked(getMessaging).mockReturnValue(messagingImpl);

        const initialized = await build(fullCredentials);
        await initialized.onModuleInit();

        return initialized;
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        firebaseAdmin = await import('firebase-admin');
        ({ getMessaging } = await import('firebase-admin/messaging'));
        ({ FirebaseService } =
            await import('@common/firebase/services/firebase.service'));
        ({ FirebaseUtil: FirebaseUtilClass } =
            await import('@common/firebase/utils/firebase.util'));
        ({ HelperArrayService: HelperArrayServiceClass } =
            await import('@common/helper/services/helper.array.service'));
        ({ FirebaseChunkSizeInvalidException } =
            await import('@common/firebase/exceptions/firebase.chunk-size-invalid.exception'));

        service = await build(fullCredentials);
    });

    describe('onModuleInit', () => {
        it('warns and skips initialization when projectId is missing', async () => {
            const notConfigured = await build({
                ...fullCredentials,
                projectId: null,
            });

            await notConfigured.onModuleInit();

            expect(firebaseAdmin.initializeApp).not.toHaveBeenCalled();
            expect(notConfigured.isInitialized()).toBe(false);
        });

        it('warns and skips initialization when clientEmail is missing', async () => {
            const notConfigured = await build({
                ...fullCredentials,
                clientEmail: null,
            });

            await notConfigured.onModuleInit();

            expect(firebaseAdmin.initializeApp).not.toHaveBeenCalled();
        });

        it('warns and skips initialization when the normalized privateKey is missing', async () => {
            const notConfigured = await build({
                ...fullCredentials,
                privateKey: null,
            });

            await notConfigured.onModuleInit();

            expect(firebaseAdmin.initializeApp).not.toHaveBeenCalled();
        });

        it('initializes the Admin SDK and messaging when every credential is present', async () => {
            const app = {} as FirebaseApp;
            const messaging = mock<Messaging>();
            vi.mocked(firebaseAdmin.cert).mockReturnValue(
                'credential' as never
            );
            vi.mocked(firebaseAdmin.initializeApp).mockReturnValue(app);
            vi.mocked(getMessaging).mockReturnValue(messaging);
            const initialized = await build(fullCredentials);

            await initialized.onModuleInit();

            expect(firebaseAdmin.cert).toHaveBeenCalledWith({
                projectId: fullCredentials.projectId,
                clientEmail: fullCredentials.clientEmail,
                privateKey: fullCredentials.privateKey,
            });
            expect(firebaseAdmin.initializeApp).toHaveBeenCalledWith({
                credential: 'credential',
            });
            expect(getMessaging).toHaveBeenCalledWith(app);
            expect(initialized.isInitialized()).toBe(true);
        });

        it('logs and swallows a failure raised while initializing', async () => {
            vi.mocked(firebaseAdmin.cert).mockReturnValue(
                'credential' as never
            );
            vi.mocked(firebaseAdmin.initializeApp).mockImplementation(() => {
                throw new Error('init failed');
            });
            const initialized = await build(fullCredentials);

            await expect(initialized.onModuleInit()).resolves.toBeUndefined();
            expect(initialized.isInitialized()).toBe(false);
        });
    });

    describe('isInitialized', () => {
        it('returns false before onModuleInit ever runs', () => {
            expect(service.isInitialized()).toBe(false);
        });
    });

    describe('sendPush', () => {
        it('returns false without sending when not initialized', async () => {
            const result = await service.sendPush('token-1', payload);

            expect(result).toBe(false);
        });

        it('sends the push and returns true on success', async () => {
            const messaging = mock<Messaging>();
            messaging.send.mockResolvedValue('message-id');
            const initialized = await initialize(messaging);

            const result = await initialized.sendPush('token-1', payload);

            expect(messaging.send).toHaveBeenCalledWith({
                token: 'token-1',
                notification: {
                    title: payload.title,
                    body: payload.body,
                    imageUrl: payload.imageUrl,
                },
                data: payload.data,
            });
            expect(result).toBe(true);
        });

        it('returns false and warns on an invalid-token FCM error', async () => {
            const messaging = mock<Messaging>();
            messaging.send.mockRejectedValue({
                code: 'messaging/invalid-registration-token',
            });
            const initialized = await initialize(messaging);

            const result = await initialized.sendPush('token-1', payload);

            expect(result).toBe(false);
        });

        it('returns false and logs an error on a non-invalid-token FCM error', async () => {
            const messaging = mock<Messaging>();
            messaging.send.mockRejectedValue({
                code: 'messaging/internal-error',
            });
            const initialized = await initialize(messaging);

            const result = await initialized.sendPush('token-1', payload);

            expect(result).toBe(false);
        });

        it('returns false and logs an error when the rejection is not an object', async () => {
            const messaging = mock<Messaging>();
            messaging.send.mockRejectedValue('plain string failure');
            const initialized = await initialize(messaging);

            const result = await initialized.sendPush('token-1', payload);

            expect(result).toBe(false);
        });

        it('returns false and logs an error when the rejection is null', async () => {
            const messaging = mock<Messaging>();
            messaging.send.mockRejectedValue(null);
            const initialized = await initialize(messaging);

            const result = await initialized.sendPush('token-1', payload);

            expect(result).toBe(false);
        });
    });

    describe('classifyError', () => {
        it('flags only definitive invalid-token errors and keeps the provider code', async () => {
            const { FirebaseMessagingError, MessagingErrorCode: M } =
                await import('firebase-admin/messaging');
            const { FirebaseAppError, AppErrorCode: A } =
                await import('firebase-admin/app');
            const cases: [unknown, string, boolean][] = [
                [
                    new FirebaseMessagingError({
                        code: M.INVALID_REGISTRATION_TOKEN,
                        message: 'bad',
                    }),
                    'messaging/invalid-registration-token',
                    true,
                ],
                [
                    new FirebaseMessagingError({
                        code: M.REGISTRATION_TOKEN_NOT_REGISTERED,
                        message: 'gone',
                    }),
                    'messaging/registration-token-not-registered',
                    true,
                ],
                [
                    new FirebaseMessagingError({
                        code: M.INVALID_ARGUMENT,
                        message: 'payload',
                    }),
                    'messaging/invalid-argument',
                    false,
                ],
                [
                    new FirebaseMessagingError({
                        code: M.SERVER_UNAVAILABLE,
                        message: 'down',
                    }),
                    'messaging/server-unavailable',
                    false,
                ],
                [
                    new FirebaseAppError({
                        code: A.NETWORK_TIMEOUT,
                        message: 'timeout',
                    }),
                    'app/network-timeout',
                    false,
                ],
                [new Error('local'), 'unknownError', false],
                [
                    { code: 'messaging/server-unavailable' },
                    'messaging/server-unavailable',
                    false,
                ],
                [{ code: 42 }, 'unknownError', false],
                ['failure', 'unknownError', false],
                [null, 'unknownError', false],
            ];
            for (const [error, code, isInvalidToken] of cases) {
                expect(service.classifyError(error)).toEqual({
                    code,
                    isInvalidToken,
                    cause: error instanceof Error ? error : null,
                });
            }
        });
    });

    describe('sendMulticast', () => {
        it('returns a zero result for no targets', async () => {
            const messaging = mock<Messaging>();
            const initialized = await initialize(messaging);
            expect(await initialized.sendMulticast([], payload)).toEqual({
                successCount: 0,
                failureCount: 0,
                failureTokens: [],
                failures: [],
            });
            expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
        });

        it('preserves permanent failures for each target when uninitialized', async () => {
            const result = await service.sendMulticast(
                ['a', 'a', 'b'],
                payload
            );
            expect(result).toMatchObject({
                successCount: 0,
                failureCount: 2,
                failureTokens: [],
                failures: [
                    {
                        token: 'a',
                        error: { isInvalidToken: false },
                    },
                    {
                        token: 'b',
                        error: { isInvalidToken: false },
                    },
                ],
            });
        });

        it.each([0, -1, FirebaseMaxSendPushBatchSize + 1, 1.5, NaN, Infinity])(
            'rejects invalid chunk size %s with the typed exception',
            async chunkSize => {
                const messaging = mock<Messaging>();
                const initialized = await initialize(messaging);
                await expect(
                    initialized.sendMulticast(['a'], payload, chunkSize)
                ).rejects.toBeInstanceOf(FirebaseChunkSizeInvalidException);
            }
        );

        it('retains every partial failure, deduplicates targets, and marks only definitive invalid tokens', async () => {
            const { FirebaseMessagingError, MessagingErrorCode: M } =
                await import('firebase-admin/messaging');
            const invalid = new FirebaseMessagingError({
                code: M.REGISTRATION_TOKEN_NOT_REGISTERED,
                message: 'gone',
            });
            const transient = new FirebaseMessagingError({
                code: M.SERVER_UNAVAILABLE,
                message: 'down',
            });
            const payloadError = new FirebaseMessagingError({
                code: M.INVALID_ARGUMENT,
                message: 'payload',
            });
            const messaging = mock<Messaging>();
            const initialized = await initialize(messaging);
            helperArrayService.chunk.mockReturnValue([['a', 'b', 'c', 'd']]);
            messaging.sendEachForMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 3,
                responses: [
                    { success: true, messageId: 'id' },
                    { success: false, error: invalid },
                    { success: false, error: transient },
                    { success: false, error: payloadError },
                ],
            });
            const result = await initialized.sendMulticast(
                ['a', 'b', 'a', 'c', 'd'],
                payload
            );
            expect(helperArrayService.chunk).toHaveBeenCalledWith(
                ['a', 'b', 'c', 'd'],
                500
            );
            expect(result).toEqual({
                successCount: 1,
                failureCount: 3,
                failureTokens: ['b'],
                failures: [
                    {
                        token: 'b',
                        error: {
                            code: 'messaging/registration-token-not-registered',
                            isInvalidToken: true,
                            cause: invalid,
                        },
                    },
                    {
                        token: 'c',
                        error: {
                            code: 'messaging/server-unavailable',
                            isInvalidToken: false,
                            cause: transient,
                        },
                    },
                    {
                        token: 'd',
                        error: {
                            code: 'messaging/invalid-argument',
                            isInvalidToken: false,
                            cause: payloadError,
                        },
                    },
                ],
            });
        });

        it('keeps input order across successful and rejected chunks', async () => {
            const { FirebaseAppError, AppErrorCode } =
                await import('firebase-admin/app');
            const network = new FirebaseAppError({
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'timeout',
            });
            const messaging = mock<Messaging>();
            const initialized = await initialize(messaging);
            helperArrayService.chunk.mockReturnValue([['a'], ['b', 'c']]);
            messaging.sendEachForMulticast
                .mockResolvedValueOnce({
                    successCount: 1,
                    failureCount: 0,
                    responses: [{ success: true, messageId: 'id' }],
                })
                .mockRejectedValueOnce(network);
            const result = await initialized.sendMulticast(
                ['a', 'b', 'c'],
                payload,
                2
            );
            expect(result).toMatchObject({
                successCount: 1,
                failureCount: 2,
                failureTokens: [],
                failures: [
                    {
                        token: 'b',
                        error: {
                            code: 'app/network-timeout',
                            cause: network,
                        },
                    },
                    {
                        token: 'c',
                        error: {
                            code: 'app/network-timeout',
                            cause: network,
                        },
                    },
                ],
            });
        });

        it('does not invent an invalid token for an untyped chunk rejection', async () => {
            const messaging = mock<Messaging>();
            const initialized = await initialize(messaging);
            helperArrayService.chunk.mockReturnValue([['a']]);
            messaging.sendEachForMulticast.mockRejectedValue('unexpected');
            expect(
                await initialized.sendMulticast(['a'], payload)
            ).toMatchObject({
                successCount: 0,
                failureCount: 1,
                failureTokens: [],
                failures: [
                    {
                        token: 'a',
                        error: {
                            code: 'unknownError',
                            isInvalidToken: false,
                            cause: null,
                        },
                    },
                ],
            });
        });
    });
});
