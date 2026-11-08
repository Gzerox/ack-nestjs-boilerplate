import {
    AuthorizationErrorException,
    EndpointDisabledException,
    InvalidParameterException,
    InvalidParameterValueException,
    InvalidSecurityException,
    NotFoundException,
    PublishCommand,
    SNSClient,
    ValidationException,
} from '@aws-sdk/client-sns';
import type { IAwsDeliveryError } from '@common/aws/interfaces/aws.delivery.interface';
import { classifyAwsDeliveryError } from '@common/aws/utils/aws.delivery.util';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
    PublishCommandInput,
    PublishCommandOutput,
} from '@aws-sdk/client-sns';
import type { IAwsSnsSendResult } from '@common/aws/interfaces/aws.sns.interface';

@Injectable()
export class AwsSNSService implements OnModuleInit {
    private readonly logger = new Logger(AwsSNSService.name);

    private readonly iamKey: string | null;
    private readonly iamSecret: string | null;
    private readonly region: string | null;
    private readonly senderId: string | null;

    private snsClient: SNSClient;

    constructor(private readonly configService: ConfigService) {
        this.iamKey = this.configService.get<string | null>('aws.sns.iam.key')!;
        this.iamSecret = this.configService.get<string | null>(
            'aws.sns.iam.secret'
        )!;
        this.region = this.configService.get<string | null>('aws.sns.region')!;
        this.senderId = this.configService.get<string | null>(
            'aws.sns.senderId'
        )!;
    }

    onModuleInit(): void {
        if (!this.iamKey || !this.iamSecret || !this.region) {
            this.logger.warn(
                'AWS SNS credentials not configured. SMS functionalities will be disabled.'
            );

            return;
        }

        this.snsClient = new SNSClient({
            credentials: {
                accessKeyId: this.iamKey,
                secretAccessKey: this.iamSecret,
            },
            region: this.region,
        });
    }

    isInitialized(): boolean {
        return !!this.snsClient;
    }

    classifyError(error: unknown): IAwsDeliveryError {
        const classified = classifyAwsDeliveryError(error);
        if (
            error instanceof AuthorizationErrorException ||
            error instanceof InvalidParameterException ||
            error instanceof InvalidParameterValueException ||
            error instanceof InvalidSecurityException ||
            error instanceof NotFoundException ||
            error instanceof ValidationException ||
            error instanceof EndpointDisabledException
        ) {
            return { ...classified, isRetryable: false };
        }

        return classified;
    }

    async send(
        phoneNumber: string,
        message: string
    ): Promise<IAwsSnsSendResult> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn(
                'AWS SNS credentials not configured. SMS functionalities will be disabled.'
            );

            return { messageId: null };
        }

        const command: PublishCommand = new PublishCommand({
            PhoneNumber: phoneNumber,
            Message: message,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional',
                },
                ...(this.senderId
                    ? {
                          'AWS.SNS.SMS.SenderID': {
                              DataType: 'String',
                              StringValue: this.senderId,
                          },
                      }
                    : {}),
            },
        });

        const published: PublishCommandOutput = await this.snsClient.send<
            PublishCommandInput,
            PublishCommandOutput
        >(command);

        return { messageId: published.MessageId ?? null };
    }
}
