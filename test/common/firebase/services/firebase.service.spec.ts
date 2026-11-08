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
import { HelperDateService } from '@common/helper/services/helper.date.service';

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
                {
                    provide: HelperDateService,
                    useValue: {
                        create: () => new Date('2026-11-08T12:00:00Z'),
                    },
                },
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
        it('uses separate messaging and app error types, with safe unknown fallbacks', async () => {
            const { FirebaseMessagingError, MessagingErrorCode: M } =
                await import('firebase-admin/messaging');
            const {
                FirebaseAppError,
                AppErrorCode: A,
                FirebaseError,
            } = await import('firebase-admin/app');
            const cases: [unknown, string, boolean, boolean][] = [
                ...[
                    M.SERVER_UNAVAILABLE,
                    M.INTERNAL_ERROR,
                    M.UNKNOWN_ERROR,
                    M.MESSAGE_RATE_EXCEEDED,
                    M.DEVICE_MESSAGE_RATE_EXCEEDED,
                ].map(
                    code =>
                        [
                            new FirebaseMessagingError({
                                code,
                                message: 'provider',
                            }),
                            `messaging/${code}`,
                            true,
                            false,
                        ] as [unknown, string, boolean, boolean]
                ),
                ...[
                    M.INVALID_REGISTRATION_TOKEN,
                    M.REGISTRATION_TOKEN_NOT_REGISTERED,
                ].map(
                    code =>
                        [
                            new FirebaseMessagingError({
                                code,
                                message: 'invalid',
                            }),
                            `messaging/${code}`,
                            false,
                            true,
                        ] as [unknown, string, boolean, boolean]
                ),
                ...[
                    M.INVALID_ARGUMENT,
                    M.INVALID_PAYLOAD,
                    M.MISMATCHED_CREDENTIAL,
                    M.THIRD_PARTY_AUTH_ERROR,
                ].map(
                    code =>
                        [
                            new FirebaseMessagingError({
                                code,
                                message: 'request',
                            }),
                            `messaging/${code}`,
                            false,
                            false,
                        ] as [unknown, string, boolean, boolean]
                ),
                ...[A.NETWORK_ERROR, A.NETWORK_TIMEOUT].map(
                    code =>
                        [
                            new FirebaseAppError({ code, message: 'network' }),
                            `app/${code}`,
                            true,
                            false,
                        ] as [unknown, string, boolean, boolean]
                ),
                [
                    new FirebaseAppError({
                        code: A.INTERNAL_ERROR,
                        message: 'local app',
                    }),
                    'app/internal-error',
                    false,
                    false,
                ],
                [
                    new FirebaseAppError({
                        code: A.INVALID_ARGUMENT,
                        message: 'local app',
                    }),
                    'app/invalid-argument',
                    false,
                    false,
                ],
                [
                    new FirebaseMessagingError({
                        code: A.NETWORK_ERROR,
                        message: 'wrong namespace',
                    }),
                    'messaging/network-error',
                    false,
                    false,
                ],
                [
                    new FirebaseError({
                        code: 'messaging/new-provider-code',
                        message: 'new',
                    }),
                    'messaging/new-provider-code',
                    false,
                    false,
                ],
                [new Error('local'), 'unknownError', false, false],
                [
                    { code: 'messaging/server-unavailable' },
                    'messaging/server-unavailable',
                    false,
                    false,
                ],
                [{ code: 42 }, 'unknownError', false, false],
                ['failure', 'unknownError', false, false],
                [null, 'unknownError', false, false],
            ];
            for (const [error, code, isRetryable, isInvalidToken] of cases) {
                expect(service.classifyError(error)).toMatchObject({
                    code,
                    isRetryable,
                    isInvalidToken,
                    cause: error instanceof Error ? error : null,
                });
            }
        });

        it.each([
            ['120', 120000],
            ['0', 0],
            ['1.5', 1500],
            ['Sun, 08 Nov 2026 12:02:00 GMT', 120000],
            ['Sun, 08 Nov 2026 11:59:00 GMT', 60000],
            ['-1', 60000],
            ['Infinity', 60000],
            ['NaN', 60000],
            ['', 60000],
            ['bad', 60000],
            [42, 60000],
            [undefined, 60000],
        ])(
            'normalizes throttle Retry-After %s to %s ms',
            async (header, retryAfterInMs) => {
                const { FirebaseMessagingError, MessagingErrorCode: M } =
                    await import('firebase-admin/messaging');
                const error = new FirebaseMessagingError({
                    code: M.MESSAGE_RATE_EXCEEDED,
                    message: 'quota',
                    httpResponse: {
                        status: 429,
                        headers: { 'retry-after': header },
                    },
                });
                expect(service.classifyError(error)).toMatchObject({
                    isRetryable: true,
                    retryAfterInMs,
                });
            }
        );

        it('retains a server retry hint and ignores an invalid non-throttle hint', async () => {
            const { FirebaseMessagingError, MessagingErrorCode: M } =
                await import('firebase-admin/messaging');
            const unavailable = new FirebaseMessagingError({
                code: M.SERVER_UNAVAILABLE,
                message: 'down',
                httpResponse: { status: 503, headers: { 'retry-after': '90' } },
            });
            expect(service.classifyError(unavailable).retryAfterInMs).toBe(
                90000
            );
            const invalid = new FirebaseMessagingError({
                code: M.INTERNAL_ERROR,
                message: 'down',
                httpResponse: {
                    status: 500,
                    headers: { 'retry-after': 'bad' },
                },
            });
            expect(service.classifyError(invalid).retryAfterInMs).toBeNull();
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
                        error: { isRetryable: false, isInvalidToken: false },
                    },
                    {
                        token: 'b',
                        error: { isRetryable: false, isInvalidToken: false },
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
                            isRetryable: false,
                            isInvalidToken: true,
                            retryAfterInMs: null,
                            cause: invalid,
                        },
                    },
                    {
                        token: 'c',
                        error: {
                            code: 'messaging/server-unavailable',
                            isRetryable: true,
                            isInvalidToken: false,
                            retryAfterInMs: null,
                            cause: transient,
                        },
                    },
                    {
                        token: 'd',
                        error: {
                            code: 'messaging/invalid-argument',
                            isRetryable: false,
                            isInvalidToken: false,
                            retryAfterInMs: null,
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
                            isRetryable: true,
                            cause: network,
                        },
                    },
                    {
                        token: 'c',
                        error: {
                            code: 'app/network-timeout',
                            isRetryable: true,
                            cause: network,
                        },
                    },
                ],
            });
        });

        it('does not retry an untyped chunk rejection or invent an invalid token', async () => {
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
                            isRetryable: false,
                            isInvalidToken: false,
                            cause: null,
                        },
                    },
                ],
            });
        });
    });
});
