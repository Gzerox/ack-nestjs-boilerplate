import type { BulkEmailStatus } from '@aws-sdk/client-ses';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';
import { EnumAwsStatusCodeError } from '@common/aws/enums/aws.status-code.enum';
import type {
    IAwsSESSend,
    IAwsSESSendBulk,
    IAwsSESTemplate,
} from '@common/aws/interfaces/aws.ses.interface';

vi.mock('@aws-sdk/client-ses', async importOriginal => {
    const actual = await importOriginal<typeof import('@aws-sdk/client-ses')>();

    return { ...actual, SESClient: vi.fn() };
});

describe('AwsSESService', () => {
    const send = vi.fn();

    let SESClient: typeof import('@aws-sdk/client-ses').SESClient;
    let AwsSESService: typeof import('@common/aws/services/aws.ses.service').AwsSESService;
    let AwsSesTemplateBodyRequiredException: typeof import('@common/aws/exceptions/aws.ses-template-body-required.exception').AwsSesTemplateBodyRequiredException;

    const configValues: Record<string, unknown> = {
        'aws.ses.iam.key': 'ses-key',
        'aws.ses.iam.secret': 'ses-secret',
        'aws.ses.region': 'us-east-1',
    };

    const configGet = vi.fn<(key: string) => unknown>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>({
        get: configGet as ConfigService['get'],
    });

    const buildService = async (
        overrides: Record<string, unknown> = {}
    ): Promise<InstanceType<typeof AwsSESService>> => {
        configGet.mockImplementation((key: string) =>
            Object.hasOwn(overrides, key) ? overrides[key] : configValues[key]
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AwsSESService,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        return module.get(AwsSESService);
    };

    const buildInitializedService = async (
        overrides: Record<string, unknown> = {}
    ): Promise<InstanceType<typeof AwsSESService>> => {
        const service = await buildService(overrides);
        service.onModuleInit();

        return service;
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();
        ({ SESClient } = await import('@aws-sdk/client-ses'));
        ({ AwsSESService } =
            await import('@common/aws/services/aws.ses.service'));
        ({ AwsSesTemplateBodyRequiredException } =
            await import('@common/aws/exceptions/aws.ses-template-body-required.exception'));

        send.mockReset();
        vi.mocked(SESClient).mockImplementation(function AwsSesClientDouble() {
            return { send } as unknown as InstanceType<typeof SESClient>;
        });
    });

    describe('onModuleInit', () => {
        it('does not create a client when the key is missing', async () => {
            const service = await buildService({ 'aws.ses.iam.key': null });

            service.onModuleInit();

            expect(service.isInitialized()).toBe(false);
            expect(SESClient).not.toHaveBeenCalled();
        });

        it('does not create a client when the secret is missing', async () => {
            const service = await buildService({
                'aws.ses.iam.secret': null,
            });

            service.onModuleInit();

            expect(service.isInitialized()).toBe(false);
            expect(SESClient).not.toHaveBeenCalled();
        });

        it('does not create a client when the region is missing', async () => {
            const service = await buildService({ 'aws.ses.region': null });

            service.onModuleInit();

            expect(service.isInitialized()).toBe(false);
            expect(SESClient).not.toHaveBeenCalled();
        });

        it('creates a client when every credential is present', async () => {
            const service = await buildService();

            service.onModuleInit();

            expect(service.isInitialized()).toBe(true);
            expect(SESClient).toHaveBeenCalledWith({
                credentials: {
                    accessKeyId: 'ses-key',
                    secretAccessKey: 'ses-secret',
                },
                region: 'us-east-1',
            });
        });
    });

    describe('isInitialized', () => {
        it('is false before onModuleInit runs', async () => {
            const service = await buildService();

            expect(service.isInitialized()).toBe(false);
        });

        it('is true after onModuleInit creates the client', async () => {
            const service = await buildInitializedService();

            expect(service.isInitialized()).toBe(true);
        });
    });

    describe('checkConnection', () => {
        it('returns false when not initialized', async () => {
            const service = await buildService();

            await expect(service.checkConnection()).resolves.toBe(false);
        });

        it('returns true when the client answers', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({});

            await expect(service.checkConnection()).resolves.toBe(true);
        });

        it('returns false when the client throws', async () => {
            const service = await buildInitializedService();
            send.mockRejectedValueOnce(new Error('down'));

            await expect(service.checkConnection()).resolves.toBe(false);
        });
    });

    describe('listTemplates', () => {
        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(service.listTemplates()).resolves.toEqual({
                TemplatesMetadata: [],
                $metadata: {},
            });
        });

        it('lists templates from the client', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({
                TemplatesMetadata: [{ Name: 'welcome' }],
                $metadata: {},
            });

            await expect(service.listTemplates('next-token')).resolves.toEqual({
                TemplatesMetadata: [{ Name: 'welcome' }],
                $metadata: {},
            });
        });
    });

    describe('getTemplate', () => {
        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(
                service.getTemplate({ name: 'welcome' })
            ).resolves.toEqual({ $metadata: {}, Template: undefined });
        });

        it('gets the template from the client', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({
                $metadata: {},
                Template: { TemplateName: 'welcome' },
            });

            await expect(
                service.getTemplate({ name: 'welcome' })
            ).resolves.toEqual({
                $metadata: {},
                Template: { TemplateName: 'welcome' },
            });
        });
    });

    describe('createTemplate', () => {
        const template: IAwsSESTemplate = {
            name: 'welcome',
            subject: 'Welcome',
            htmlBody: '<p>Welcome</p>',
            plainTextBody: 'Welcome',
        };

        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(service.createTemplate(template)).resolves.toEqual({
                $metadata: {},
            });
        });

        it('throws when both bodies are missing', async () => {
            const service = await buildInitializedService();

            const rejection = service.createTemplate({
                name: 'welcome',
                subject: 'Welcome',
            });

            await expect(rejection).rejects.toBeInstanceOf(
                AwsSesTemplateBodyRequiredException
            );
            await expect(rejection).rejects.toMatchObject({
                module: 'aws',
                statusCode: EnumAwsStatusCodeError.sesTemplateBodyRequired,
                statusCodeKey:
                    EnumAwsStatusCodeError[
                        EnumAwsStatusCodeError.sesTemplateBodyRequired
                    ],
                httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
                messagePath: 'aws.error.sesTemplateBodyRequired',
            });
        });

        it('creates the template', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ $metadata: {} });

            await expect(service.createTemplate(template)).resolves.toEqual({
                $metadata: {},
            });
        });
    });

    describe('updateTemplate', () => {
        const template: IAwsSESTemplate = {
            name: 'welcome',
            subject: 'Welcome',
            htmlBody: '<p>Welcome</p>',
        };

        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(service.updateTemplate(template)).resolves.toEqual({
                $metadata: {},
            });
        });

        it('throws when both bodies are missing', async () => {
            const service = await buildInitializedService();

            const rejection = service.updateTemplate({
                name: 'welcome',
                subject: 'Welcome',
            });

            await expect(rejection).rejects.toBeInstanceOf(
                AwsSesTemplateBodyRequiredException
            );
            await expect(rejection).rejects.toMatchObject({
                module: 'aws',
                statusCode: EnumAwsStatusCodeError.sesTemplateBodyRequired,
                statusCodeKey:
                    EnumAwsStatusCodeError[
                        EnumAwsStatusCodeError.sesTemplateBodyRequired
                    ],
                httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
                messagePath: 'aws.error.sesTemplateBodyRequired',
            });
        });

        it('updates the template', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ $metadata: {} });

            await expect(service.updateTemplate(template)).resolves.toEqual({
                $metadata: {},
            });
        });
    });

    describe('deleteTemplate', () => {
        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(
                service.deleteTemplate({ name: 'welcome' })
            ).resolves.toEqual({ $metadata: {} });
        });

        it('deletes the template', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ $metadata: {} });

            await expect(
                service.deleteTemplate({ name: 'welcome' })
            ).resolves.toEqual({ $metadata: {} });
        });
    });

    describe('send', () => {
        const payload: IAwsSESSend = {
            templateName: 'welcome',
            templateData: { name: 'Jane' },
            sender: 'noreply@example.com',
            recipients: ['jane@example.com'],
        };

        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(service.send(payload)).resolves.toEqual({
                MessageId: undefined,
                $metadata: {},
            });
        });

        it('sends with the given reply-to, cc and bcc', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ MessageId: 'id-1', $metadata: {} });

            await expect(
                service.send({
                    ...payload,
                    replyTo: 'reply@example.com',
                    cc: ['cc@example.com'],
                    bcc: ['bcc@example.com'],
                })
            ).resolves.toEqual({ MessageId: 'id-1', $metadata: {} });
        });

        it('defaults reply-to, cc, bcc and template data when absent', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ MessageId: 'id-2', $metadata: {} });

            await service.send({
                templateName: 'welcome',
                sender: 'noreply@example.com',
                recipients: ['jane@example.com'],
            });

            expect(send).toHaveBeenCalledTimes(1);
        });
    });

    describe('sendBulk', () => {
        const payload: IAwsSESSendBulk = {
            templateName: 'welcome',
            defaultTemplateData: { name: 'Team' },
            sender: 'noreply@example.com',
            recipients: [
                {
                    recipient: 'jane@example.com',
                    templateData: { name: 'Jane' },
                },
            ],
        };

        it('returns an empty result when not initialized', async () => {
            const service = await buildService();

            await expect(service.sendBulk(payload)).resolves.toEqual({
                Status: [],
                $metadata: {},
            });
        });

        it('sends bulk with the given reply-to, cc and bcc', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({
                Status: [{ Status: 'Success' }],
                $metadata: {},
            });

            await expect(
                service.sendBulk({
                    ...payload,
                    replyTo: 'reply@example.com',
                    cc: ['cc@example.com'],
                    bcc: ['bcc@example.com'],
                })
            ).resolves.toEqual({
                Status: [{ Status: 'Success' }],
                $metadata: {},
            });
        });

        it('defaults reply-to, cc, bcc and recipient template data when absent', async () => {
            const service = await buildInitializedService();
            send.mockResolvedValueOnce({ Status: [], $metadata: {} });

            await service.sendBulk({
                templateName: 'welcome',
                sender: 'noreply@example.com',
                recipients: [{ recipient: 'jane@example.com' }],
            });

            expect(send).toHaveBeenCalledTimes(1);
        });
    });

    describe('classifyError', () => {
        it('classifies modeled permanent exceptions before retry metadata', async () => {
            const sdk = await import('@aws-sdk/client-ses');
            const service = await buildService();
            const errors = [
                Object.assign(
                    new sdk.MessageRejected({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.TemplateDoesNotExistException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.MissingRenderingAttributeException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.MailFromDomainNotVerifiedException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.ConfigurationSetDoesNotExistException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.AccountSendingPausedException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.ConfigurationSetSendingPausedException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
            ];
            for (const error of errors) {
                expect(service.classifyError(error)).toEqual({
                    code: error.name,
                    isRetryable: false,
                    retryAfterInMs: null,
                    cause: error,
                });
            }
        });

        it('recognizes SDK retry metadata and transport failures without retrying unknown local errors', async () => {
            const sdk = await import('@aws-sdk/client-ses');
            const service = await buildService();
            const cases: [unknown, boolean][] = [
                [
                    new sdk.SESServiceException({
                        name: 'ThrottlingException',
                        message: 'rate',
                        $fault: 'client',
                        $metadata: { httpStatusCode: 400 },
                    }),
                    true,
                ],
                [
                    new sdk.SESServiceException({
                        name: 'ServiceFailure',
                        message: 'server',
                        $fault: 'server',
                        $metadata: { httpStatusCode: 503 },
                    }),
                    true,
                ],
                [
                    new sdk.SESServiceException({
                        name: 'ServerFailure',
                        message: 'server',
                        $fault: 'server',
                        $metadata: { httpStatusCode: 501 },
                    }),
                    true,
                ],
                [
                    new sdk.SESServiceException({
                        name: 'RateLimited',
                        message: 'rate',
                        $fault: 'client',
                        $metadata: { httpStatusCode: 429 },
                    }),
                    true,
                ],
                [
                    Object.assign(new Error('retry trait'), { $retryable: {} }),
                    true,
                ],
                [
                    Object.assign(new Error('timeout'), {
                        name: 'TimeoutError',
                    }),
                    true,
                ],
                [
                    Object.assign(new Error('socket'), { code: 'ECONNRESET' }),
                    true,
                ],
                [
                    new Error('wrapped', {
                        cause: Object.assign(new Error('socket'), {
                            code: 'ETIMEDOUT',
                        }),
                    }),
                    true,
                ],
                [
                    Object.assign(new Error('abort'), {
                        name: 'AbortError',
                        $retryable: {},
                        $metadata: { httpStatusCode: 503 },
                    }),
                    false,
                ],
                [
                    new sdk.SESServiceException({
                        name: 'UnlistedAuthorizationFailure',
                        message: 'denied',
                        $fault: 'client',
                        $metadata: { httpStatusCode: 403 },
                    }),
                    false,
                ],
                [new Error('local'), false],
                [new Error('malformed cause', { cause: null }), false],
                [new Error('malformed cause', { cause: 'opaque' }), false],
                [null, false],
                ['boom', false],
                [{ name: 'ThrottlingException' }, false],
            ];
            for (const [error, isRetryable] of cases) {
                expect(service.classifyError(error)).toEqual({
                    code: error instanceof Error ? error.name : 'unknownError',
                    isRetryable,
                    retryAfterInMs: null,
                    cause: error instanceof Error ? error : null,
                });
            }
        });
        it('does not retry the SES daily quota but still retries ordinary rate throttling', async () => {
            const sdk = await import('@aws-sdk/client-ses');
            const service = await buildService();
            for (const [message, isRetryable] of [
                ['Daily message quota exceeded.', false],
                ['Maximum sending rate exceeded.', true],
            ] as const) {
                const error = new sdk.SESServiceException({
                    name: 'Throttling',
                    message,
                    $fault: 'client',
                    $metadata: { httpStatusCode: 400 },
                });
                expect(service.classifyError(error).isRetryable).toBe(
                    isRetryable
                );
            }
        });
    });

    describe('isRetryableBulkStatus', () => {
        it.each(['TransientFailure', 'AccountThrottled', 'Failed'])(
            'treats the bulk status %s as retryable',
            async status => {
                const service = await buildService();

                expect(
                    service.isRetryableBulkStatus(status as BulkEmailStatus)
                ).toBe(true);
            }
        );

        it.each([
            'Success',
            'MessageRejected',
            'MailFromDomainNotVerified',
            'ConfigurationSetDoesNotExist',
            'TemplateDoesNotExist',
            'AccountSuspended',
            'AccountDailyQuotaExceeded',
            'InvalidParameterValue',
            'InvalidSendingPoolName',
        ])('treats the bulk status %s as not retryable', async status => {
            const service = await buildService();

            expect(
                service.isRetryableBulkStatus(status as BulkEmailStatus)
            ).toBe(false);
        });
    });
});
