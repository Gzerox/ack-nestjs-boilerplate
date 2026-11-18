import {
    ListLinkedWhatsAppBusinessAccountsCommand,
    SendWhatsAppMessageCommand,
    SocialMessagingClient,
} from '@aws-sdk/client-socialmessaging';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    SendWhatsAppMessageCommandInput,
    SendWhatsAppMessageCommandOutput,
} from '@aws-sdk/client-socialmessaging';
import type { IAwsSocialMessagingSendTemplate } from '@common/aws/interfaces/aws.social-messaging.interface';

@Injectable()
export class AwsSocialMessagingService implements OnModuleInit {
    private readonly logger = new Logger(AwsSocialMessagingService.name);

    private readonly iamKey: string | null;
    private readonly iamSecret: string | null;
    private readonly region: string | null;
    private readonly originationPhoneNumberId: string | null;
    private readonly metaApiVersion: string;
    private readonly templateName: string | null;
    private readonly templateLanguages: string[];
    private readonly maxAttempts: number;

    private socialMessagingClient: SocialMessagingClient;

    constructor(private readonly configService: ConfigService) {
        this.iamKey = this.configService.get<string | null>(
            'aws.socialMessaging.iam.key'
        )!;
        this.iamSecret = this.configService.get<string | null>(
            'aws.socialMessaging.iam.secret'
        )!;
        this.region = this.configService.get<string | null>(
            'aws.socialMessaging.region'
        )!;
        this.originationPhoneNumberId = this.configService.get<string | null>(
            'aws.socialMessaging.originationPhoneNumberId'
        )!;
        this.metaApiVersion = this.configService.get<string>(
            'aws.socialMessaging.metaApiVersion'
        )!;
        this.templateName = this.configService.get<string | null>(
            'aws.socialMessaging.templateName'
        )!;
        this.templateLanguages = this.configService.get<string[]>(
            'aws.socialMessaging.templateLanguages'
        )!;
        this.maxAttempts = this.configService.get<number>(
            'aws.socialMessaging.maxAttempts'
        )!;
    }

    onModuleInit(): void {
        if (
            !this.iamKey ||
            !this.iamSecret ||
            !this.region ||
            !this.originationPhoneNumberId ||
            !this.templateName
        ) {
            this.logger.warn(
                'AWS Social Messaging not configured. WhatsApp functionalities will be disabled.'
            );

            return;
        }

        this.socialMessagingClient = new SocialMessagingClient({
            credentials: {
                accessKeyId: this.iamKey,
                secretAccessKey: this.iamSecret,
            },
            region: this.region,
            maxAttempts: this.maxAttempts,
        });
    }

    isInitialized(): boolean {
        return !!this.socialMessagingClient;
    }

    async checkConnection(): Promise<boolean> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS Social Messaging not configured. WhatsApp functionalities will be disabled.'
            );
            return false;
        }

        try {
            await this.socialMessagingClient.send(
                new ListLinkedWhatsAppBusinessAccountsCommand({})
            );
            return true;
        } catch {
            return false;
        }
    }

    resolveLanguageCode(languageCode: string | null): string {
        const languages = this.templateLanguages;
        const isListed = !!languageCode && languages.includes(languageCode);
        if (isListed) {
            return languageCode;
        }

        return languages[0];
    }

    async sendAuthenticationTemplate({
        phoneNumber,
        parameter,
        languageCode,
    }: IAwsSocialMessagingSendTemplate): Promise<SendWhatsAppMessageCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS Social Messaging not configured. WhatsApp functionalities will be disabled.'
            );

            return { $metadata: {} };
        }

        const payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'template',
            template: {
                name: this.templateName,
                language: { code: languageCode },
                components: [
                    {
                        type: 'body',
                        parameters: [{ type: 'text', text: parameter }],
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [{ type: 'text', text: parameter }],
                    },
                ],
            },
        };

        const command = new SendWhatsAppMessageCommand({
            originationPhoneNumberId: this.originationPhoneNumberId!,
            metaApiVersion: this.metaApiVersion,
            message: new TextEncoder().encode(JSON.stringify(payload)),
        });

        const sent: SendWhatsAppMessageCommandOutput =
            await this.socialMessagingClient.send<
                SendWhatsAppMessageCommandInput,
                SendWhatsAppMessageCommandOutput
            >(command);
        return sent;
    }
}
