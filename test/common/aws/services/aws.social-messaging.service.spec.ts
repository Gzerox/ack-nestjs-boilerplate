import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

vi.mock('@aws-sdk/client-socialmessaging', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@aws-sdk/client-socialmessaging')
        >();

    return { ...actual, SocialMessagingClient: vi.fn() };
});

describe('AwsSocialMessagingService', () => {
    const send = vi.fn();

    let SocialMessagingClient: typeof import('@aws-sdk/client-socialmessaging').SocialMessagingClient;
    let AwsSocialMessagingService: typeof import('@common/aws/services/aws.social-messaging.service').AwsSocialMessagingService;

    const configValues: Record<string, unknown> = {
        'aws.socialMessaging.iam.key': 'sm-key',
        'aws.socialMessaging.iam.secret': 'sm-secret',
        'aws.socialMessaging.region': 'us-east-1',
        'aws.socialMessaging.originationPhoneNumberId': 'phone-number-id-1',
        'aws.socialMessaging.metaApiVersion': 'v-test-1',
        'aws.socialMessaging.templateName': 'otp_template',
        'aws.socialMessaging.templateLanguages': ['en', 'id'],
        'aws.socialMessaging.maxAttempts': 1,
    };

    const configGet = vi.fn<(key: string) => unknown>();
    const configService: MockProxy<ConfigService> = mock<ConfigService>({
        get: configGet as ConfigService['get'],
    });

    const buildService = async (
        overrides: Record<string, unknown> = {}
    ): Promise<InstanceType<typeof AwsSocialMessagingService>> => {
        configGet.mockImplementation((key: string) =>
            Object.hasOwn(overrides, key) ? overrides[key] : configValues[key]
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AwsSocialMessagingService,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        const service = module.get(AwsSocialMessagingService);
        service.onModuleInit();

        return service;
    };

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();
        ({ SocialMessagingClient } =
            await import('@aws-sdk/client-socialmessaging'));
        ({ AwsSocialMessagingService } =
            await import('@common/aws/services/aws.social-messaging.service'));

        send.mockReset();
        vi.mocked(SocialMessagingClient).mockImplementation(
            function AwsSocialMessagingClientDouble() {
                return { send } as unknown as InstanceType<
                    typeof SocialMessagingClient
                >;
            }
        );
    });

    describe('isInitialized', () => {
        it('is true when every required value is set', async () => {
            const service = await buildService();

            expect(service.isInitialized()).toBe(true);
            expect(SocialMessagingClient).toHaveBeenCalledWith({
                credentials: {
                    accessKeyId: 'sm-key',
                    secretAccessKey: 'sm-secret',
                },
                region: 'us-east-1',
                maxAttempts: 1,
            });
        });

        it.each([
            'aws.socialMessaging.iam.key',
            'aws.socialMessaging.iam.secret',
            'aws.socialMessaging.region',
            'aws.socialMessaging.originationPhoneNumberId',
            'aws.socialMessaging.templateName',
            'aws.socialMessaging.metaApiVersion',
        ])('is false and warns when %s is missing', async key => {
            const warn = vi.spyOn(Logger.prototype, 'warn');
            const service = await buildService({ [key]: null });

            expect(service.isInitialized()).toBe(false);
            expect(SocialMessagingClient).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalledWith(
                'AWS Social Messaging not configured. WhatsApp functionalities will be disabled.'
            );
        });

        it.each([
            'aws.socialMessaging.iam.key',
            'aws.socialMessaging.iam.secret',
            'aws.socialMessaging.region',
            'aws.socialMessaging.originationPhoneNumberId',
            'aws.socialMessaging.templateName',
            'aws.socialMessaging.metaApiVersion',
        ])('is false when %s is an empty string', async key => {
            const service = await buildService({ [key]: '' });

            expect(service.isInitialized()).toBe(false);
            expect(SocialMessagingClient).not.toHaveBeenCalled();
        });
    });

    describe('sendAuthenticationTemplate', () => {
        it('is a no-op when not initialized', async () => {
            const service = await buildService({
                'aws.socialMessaging.templateName': null,
            });

            const result = await service.sendAuthenticationTemplate({
                phoneNumber: '+628123456789',
                parameter: '123456',
                languageCode: 'en',
            });

            expect(result).toEqual({ $metadata: {} });
            expect(send).not.toHaveBeenCalled();
        });

        it('sends the authentication template payload', async () => {
            const { SendWhatsAppMessageCommand } =
                await import('@aws-sdk/client-socialmessaging');
            let payload: unknown = null;
            send.mockImplementation(
                (sent: InstanceType<typeof SendWhatsAppMessageCommand>) => {
                    payload = JSON.parse(
                        new TextDecoder().decode(sent.input.message)
                    );
                    return Promise.resolve({ messageId: 'm-1', $metadata: {} });
                }
            );
            const service = await buildService();

            const result = await service.sendAuthenticationTemplate({
                phoneNumber: '+628123456789',
                parameter: '123456',
                languageCode: 'en',
            });

            expect(result).toEqual({ messageId: 'm-1', $metadata: {} });
            expect(send).toHaveBeenCalledTimes(1);
            expect(send).toHaveBeenCalledWith(
                expect.any(SendWhatsAppMessageCommand)
            );
            expect(send).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: expect.objectContaining({
                        originationPhoneNumberId: 'phone-number-id-1',
                        metaApiVersion: 'v-test-1',
                    }),
                })
            );
            expect(payload).toEqual({
                messaging_product: 'whatsapp',
                to: '+628123456789',
                type: 'template',
                template: {
                    name: 'otp_template',
                    language: { code: 'en' },
                    components: [
                        {
                            type: 'body',
                            parameters: [{ type: 'text', text: '123456' }],
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [{ type: 'text', text: '123456' }],
                        },
                    ],
                },
            });
        });
    });

    describe('resolveLanguageCode', () => {
        it('returns a listed language', async () => {
            const service = await buildService();

            expect(service.resolveLanguageCode('id')).toBe('id');
        });

        it.each(['fr', null])(
            'falls back to the first listed language for %s',
            async languageCode => {
                const service = await buildService();

                expect(service.resolveLanguageCode(languageCode)).toBe('en');
            }
        );
    });

    describe('checkConnection', () => {
        it('returns false when not initialized', async () => {
            const service = await buildService({
                'aws.socialMessaging.iam.key': null,
            });

            expect(await service.checkConnection()).toBe(false);
            expect(send).not.toHaveBeenCalled();
        });

        it('returns true when the provider answers', async () => {
            const { ListLinkedWhatsAppBusinessAccountsCommand } =
                await import('@aws-sdk/client-socialmessaging');
            send.mockResolvedValue({ $metadata: {} });
            const service = await buildService();

            expect(await service.checkConnection()).toBe(true);
            expect(send).toHaveBeenCalledWith(
                expect.any(ListLinkedWhatsAppBusinessAccountsCommand)
            );
        });

        it('returns false when the provider rejects', async () => {
            send.mockRejectedValue(new Error('denied'));
            const service = await buildService();

            expect(await service.checkConnection()).toBe(false);
        });
    });
});
