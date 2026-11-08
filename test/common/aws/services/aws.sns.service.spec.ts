import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

vi.mock('@aws-sdk/client-sns', async importOriginal => {
    const actual = await importOriginal<typeof import('@aws-sdk/client-sns')>();

    return { ...actual, SNSClient: vi.fn() };
});

describe('AwsSNSService', () => {
    const send = vi.fn();

    let SNSClient: typeof import('@aws-sdk/client-sns').SNSClient;
    let AwsSNSService: typeof import('@common/aws/services/aws.sns.service').AwsSNSService;

    const configValues: Record<string, unknown> = {
        'aws.sns.iam.key': 'sns-key',
        'aws.sns.iam.secret': 'sns-secret',
        'aws.sns.region': 'us-east-1',
        'aws.sns.senderId': 'ACK',
    };

    const configGet = vi.fn<(key: string) => unknown>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>({
        get: configGet as ConfigService['get'],
    });

    const buildService = async (
        overrides: Record<string, unknown> = {}
    ): Promise<InstanceType<typeof AwsSNSService>> => {
        configGet.mockImplementation((key: string) =>
            Object.hasOwn(overrides, key) ? overrides[key] : configValues[key]
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AwsSNSService,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        const service = module.get(AwsSNSService);
        service.onModuleInit();

        return service;
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();
        ({ SNSClient } = await import('@aws-sdk/client-sns'));
        ({ AwsSNSService } =
            await import('@common/aws/services/aws.sns.service'));

        send.mockReset();
        vi.mocked(SNSClient).mockImplementation(function AwsSnsClientDouble() {
            return { send } as unknown as InstanceType<typeof SNSClient>;
        });
    });

    describe('send', () => {
        it('is a no-op when credentials are missing', async () => {
            const service = await buildService({ 'aws.sns.iam.key': null });

            const result = await service.send('+15550100', 'hello');

            expect(service.isInitialized()).toBe(false);
            expect(SNSClient).not.toHaveBeenCalled();
            expect(send).not.toHaveBeenCalled();
            expect(result).toEqual({ messageId: null });
        });

        it('publishes with Transactional and the sender id', async () => {
            send.mockResolvedValue({ MessageId: 'm-1', $metadata: {} });
            const service = await buildService();

            const result = await service.send('+15550100', 'hello');

            expect(result).toEqual({ messageId: 'm-1' });
            expect(send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: {
                        PhoneNumber: '+15550100',
                        Message: 'hello',
                        MessageAttributes: {
                            'AWS.SNS.SMS.SMSType': {
                                DataType: 'String',
                                StringValue: 'Transactional',
                            },
                            'AWS.SNS.SMS.SenderID': {
                                DataType: 'String',
                                StringValue: 'ACK',
                            },
                        },
                    },
                })
            );
        });

        it('omits the sender id attribute when none is configured', async () => {
            send.mockResolvedValue({ $metadata: {} });
            const service = await buildService({ 'aws.sns.senderId': null });

            const result = await service.send('+15550100', 'hello');

            expect(result).toEqual({ messageId: null });
            expect(send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: {
                        PhoneNumber: '+15550100',
                        Message: 'hello',
                        MessageAttributes: {
                            'AWS.SNS.SMS.SMSType': {
                                DataType: 'String',
                                StringValue: 'Transactional',
                            },
                        },
                    },
                })
            );
        });
    });

    describe('classifyError', () => {
        it('classifies modeled permanent exceptions before retry metadata', async () => {
            const sdk = await import('@aws-sdk/client-sns');
            const service = await buildService();
            const errors = [
                Object.assign(
                    new sdk.AuthorizationErrorException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.InvalidParameterException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.InvalidParameterValueException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.InvalidSecurityException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.NotFoundException({
                        message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.ValidationException({
                        message: 'invalid',
                        Message: 'invalid',
                        $metadata: {},
                    }),
                    { $retryable: {} }
                ),
                Object.assign(
                    new sdk.EndpointDisabledException({
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
            const sdk = await import('@aws-sdk/client-sns');
            const service = await buildService();
            const cases: [unknown, boolean][] = [
                [
                    new sdk.SNSServiceException({
                        name: 'ThrottlingException',
                        message: 'rate',
                        $fault: 'client',
                        $metadata: { httpStatusCode: 400 },
                    }),
                    true,
                ],
                [
                    new sdk.SNSServiceException({
                        name: 'ServiceFailure',
                        message: 'server',
                        $fault: 'server',
                        $metadata: { httpStatusCode: 503 },
                    }),
                    true,
                ],
                [
                    new sdk.SNSServiceException({
                        name: 'ServerFailure',
                        message: 'server',
                        $fault: 'server',
                        $metadata: { httpStatusCode: 501 },
                    }),
                    true,
                ],
                [
                    new sdk.SNSServiceException({
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
                    new sdk.SNSServiceException({
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
    });
});
