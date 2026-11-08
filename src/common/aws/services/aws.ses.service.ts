import {
    AccountSendingPausedException,
    ConfigurationSetDoesNotExistException,
    ConfigurationSetSendingPausedException,
    CreateTemplateCommand,
    DeleteTemplateCommand,
    GetSendQuotaCommand,
    GetTemplateCommand,
    ListTemplatesCommand,
    MailFromDomainNotVerifiedException,
    MessageRejected,
    MissingRenderingAttributeException,
    SESClient,
    SendBulkTemplatedEmailCommand,
    SendTemplatedEmailCommand,
    TemplateDoesNotExistException,
    UpdateTemplateCommand,
} from '@aws-sdk/client-ses';
import type { IAwsDeliveryError } from '@common/aws/interfaces/aws.delivery.interface';
import { classifyAwsDeliveryError } from '@common/aws/utils/aws.delivery.util';
import { isAwsSESDailyQuotaExceeded } from '@common/aws/utils/aws.ses.util';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    BulkEmailStatus,
    CreateTemplateCommandInput,
    CreateTemplateCommandOutput,
    DeleteTemplateCommandInput,
    DeleteTemplateCommandOutput,
    GetTemplateCommandInput,
    GetTemplateCommandOutput,
    ListTemplatesCommandInput,
    ListTemplatesCommandOutput,
    SendBulkTemplatedEmailCommandInput,
    SendBulkTemplatedEmailCommandOutput,
    SendTemplatedEmailCommandInput,
    SendTemplatedEmailCommandOutput,
    UpdateTemplateCommandInput,
    UpdateTemplateCommandOutput,
} from '@aws-sdk/client-ses';
import type {
    IAwsSESGetTemplate,
    IAwsSESSend,
    IAwsSESSendBulk,
    IAwsSESTemplate,
} from '@common/aws/interfaces/aws.ses.interface';
import { AwsSesTemplateBodyRequiredException } from '@common/aws/exceptions/aws.ses-template-body-required.exception';
import { AwsSESRetryableBulkStatuses } from '@common/aws/constants/aws.constant';

@Injectable()
export class AwsSESService implements OnModuleInit {
    private readonly logger = new Logger(AwsSESService.name);

    private readonly iamKey: string | null;
    private readonly iamSecret: string | null;
    private readonly region: string | null;
    private readonly maxAttempts: number;

    private sesClient: SESClient;

    constructor(private readonly configService: ConfigService) {
        this.iamKey = this.configService.get<string | null>('aws.ses.iam.key')!;
        this.iamSecret = this.configService.get<string | null>(
            'aws.ses.iam.secret'
        )!;
        this.region = this.configService.get<string | null>('aws.ses.region')!;
        this.maxAttempts = this.configService.get<number>(
            'aws.ses.maxAttempts'
        )!;
    }

    onModuleInit(): void {
        if (!this.iamKey || !this.iamSecret || !this.region) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return;
        }

        this.sesClient = new SESClient({
            credentials: {
                accessKeyId: this.iamKey,
                secretAccessKey: this.iamSecret,
            },
            region: this.region,
            maxAttempts: this.maxAttempts,
        });
    }

    isInitialized(): boolean {
        return !!this.sesClient;
    }

    classifyError(error: unknown): IAwsDeliveryError {
        const classified = classifyAwsDeliveryError(error);
        if (
            error instanceof MessageRejected ||
            error instanceof TemplateDoesNotExistException ||
            error instanceof MissingRenderingAttributeException ||
            error instanceof MailFromDomainNotVerifiedException ||
            error instanceof ConfigurationSetDoesNotExistException ||
            error instanceof AccountSendingPausedException ||
            error instanceof ConfigurationSetSendingPausedException
        ) {
            return { ...classified, isRetryable: false };
        }

        if (isAwsSESDailyQuotaExceeded(error)) {
            return { ...classified, isRetryable: false };
        }

        return classified;
    }

    isRetryableBulkStatus(status: BulkEmailStatus): boolean {
        return AwsSESRetryableBulkStatuses.includes(status);
    }

    async checkConnection(): Promise<boolean> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return false;
        }

        try {
            await this.sesClient.send<
                ListTemplatesCommandInput,
                ListTemplatesCommandOutput
            >(new GetSendQuotaCommand({}));

            return true;
        } catch {
            return false;
        }
    }

    async listTemplates(
        nextToken?: string
    ): Promise<ListTemplatesCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return {
                TemplatesMetadata: [],
                $metadata: {},
            } as ListTemplatesCommandOutput;
        }

        const command: ListTemplatesCommand = new ListTemplatesCommand({
            MaxItems: 20,
            NextToken: nextToken,
        });

        const listTemplate: ListTemplatesCommandOutput =
            await this.sesClient.send<
                ListTemplatesCommandInput,
                ListTemplatesCommandOutput
            >(command);
        return listTemplate;
    }

    async getTemplate({
        name,
    }: IAwsSESGetTemplate): Promise<GetTemplateCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return {
                $metadata: {},
                Template: undefined,
            } as GetTemplateCommandOutput;
        }

        const command: GetTemplateCommand = new GetTemplateCommand({
            TemplateName: name,
        });

        const getTemplate: GetTemplateCommandOutput = await this.sesClient.send<
            GetTemplateCommandInput,
            GetTemplateCommandOutput
        >(command);

        return getTemplate;
    }

    async createTemplate({
        name,
        subject,
        htmlBody,
        plainTextBody,
    }: IAwsSESTemplate): Promise<CreateTemplateCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return { $metadata: {} } as CreateTemplateCommandOutput;
        }

        if (!htmlBody && !plainTextBody) {
            throw new AwsSesTemplateBodyRequiredException();
        }

        const command: CreateTemplateCommand = new CreateTemplateCommand({
            Template: {
                TemplateName: name,
                SubjectPart: subject,
                HtmlPart: htmlBody,
                TextPart: plainTextBody,
            },
        });

        const create: CreateTemplateCommandOutput = await this.sesClient.send<
            CreateTemplateCommandInput,
            CreateTemplateCommandOutput
        >(command);

        return create;
    }

    async updateTemplate({
        name,
        subject,
        htmlBody,
        plainTextBody,
    }: IAwsSESTemplate): Promise<UpdateTemplateCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return { $metadata: {} } as UpdateTemplateCommandOutput;
        }

        if (!htmlBody && !plainTextBody) {
            throw new AwsSesTemplateBodyRequiredException();
        }

        const command: UpdateTemplateCommand = new UpdateTemplateCommand({
            Template: {
                TemplateName: name,
                SubjectPart: subject,
                HtmlPart: htmlBody,
                TextPart: plainTextBody,
            },
        });

        const update: UpdateTemplateCommandOutput = await this.sesClient.send<
            UpdateTemplateCommandInput,
            UpdateTemplateCommandOutput
        >(command);

        return update;
    }

    async deleteTemplate({
        name,
    }: IAwsSESGetTemplate): Promise<DeleteTemplateCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return { $metadata: {} } as DeleteTemplateCommandOutput;
        }

        const command: DeleteTemplateCommand = new DeleteTemplateCommand({
            TemplateName: name,
        });

        const del: DeleteTemplateCommandOutput = await this.sesClient.send<
            DeleteTemplateCommandInput,
            DeleteTemplateCommandOutput
        >(command);

        return del;
    }

    async send({
        recipients,
        sender,
        replyTo,
        bcc,
        cc,
        templateName,
        templateData,
    }: IAwsSESSend): Promise<SendTemplatedEmailCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return {
                MessageId: undefined,
                $metadata: {},
            } as SendTemplatedEmailCommandOutput;
        }

        const command: SendTemplatedEmailCommand =
            new SendTemplatedEmailCommand({
                Template: templateName,
                Destination: {
                    ToAddresses: recipients,
                    BccAddresses: bcc ?? [],
                    CcAddresses: cc ?? [],
                },
                Source: sender,
                TemplateData: JSON.stringify(templateData ?? ''),
                ReplyToAddresses: [replyTo ?? sender],
            });

        const sendWithTemplate: SendTemplatedEmailCommandOutput =
            await this.sesClient.send<
                SendTemplatedEmailCommandInput,
                SendTemplatedEmailCommandOutput
            >(command);

        return sendWithTemplate;
    }

    async sendBulk({
        recipients,
        sender,
        replyTo,
        bcc,
        cc,
        templateName,
        defaultTemplateData,
    }: IAwsSESSendBulk): Promise<SendBulkTemplatedEmailCommandOutput> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SES credentials not configured. Email functionalities will be disabled.'
            );

            return {
                Status: [],
                $metadata: {},
            } as SendBulkTemplatedEmailCommandOutput;
        }

        const command: SendBulkTemplatedEmailCommand =
            new SendBulkTemplatedEmailCommand({
                Template: templateName,
                Destinations: recipients.map(e => ({
                    Destination: {
                        ToAddresses: [e.recipient],
                        BccAddresses: bcc ?? [],
                        CcAddresses: cc ?? [],
                    },
                    ReplacementTemplateData: JSON.stringify(
                        e.templateData ?? ''
                    ),
                })),
                Source: sender,
                DefaultTemplateData: JSON.stringify(defaultTemplateData ?? {}),
                ReplyToAddresses: [replyTo ?? sender],
            });

        const sendWithTemplate: SendBulkTemplatedEmailCommandOutput =
            await this.sesClient.send<
                SendBulkTemplatedEmailCommandInput,
                SendBulkTemplatedEmailCommandOutput
            >(command);

        return sendWithTemplate;
    }
}
