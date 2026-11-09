import type { Messaging } from 'firebase-admin/messaging';
import { FirebaseMaxSendPushBatchSize } from '@common/firebase/constants/firebase.constant';
import type {
    IFirebaseDeliveryError,
    IFirebasePushFailure,
    IFirebasePushPayload,
    IFirebasePushResult,
} from '@common/firebase/interfaces/firebase.interface';
import { FirebaseUtil } from '@common/firebase/utils/firebase.util';
import { FirebaseChunkSizeInvalidException } from '@common/firebase/exceptions/firebase.chunk-size-invalid.exception';
import { HelperArrayService } from '@common/helper/services/helper.array.service';
import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as firebaseAdmin from 'firebase-admin';
import type { App as FirebaseApp } from 'firebase-admin/app';
import {
    FirebaseMessagingError,
    MessagingErrorCode,
    getMessaging,
} from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);

    private readonly projectId: string | null;
    private readonly clientEmail: string | null;
    private privateKey: string | null;

    private app: FirebaseApp | null = null;
    private messaging: Messaging | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly helperArrayService: HelperArrayService,
        private readonly firebaseUtil: FirebaseUtil
    ) {
        this.projectId = this.configService.get<string | null>(
            'firebase.projectId'
        )!;
        this.clientEmail = this.configService.get<string | null>(
            'firebase.clientEmail'
        )!;

        const privateKey = this.configService.get<string | null>(
            'firebase.privateKey'
        )!;
        this.privateKey = this.firebaseUtil.normalizePrivateKey(privateKey);
    }

    classifyError(error: unknown): IFirebaseDeliveryError {
        const isInvalidToken =
            error instanceof FirebaseMessagingError &&
            (error.hasCode(MessagingErrorCode.INVALID_REGISTRATION_TOKEN) ||
                error.hasCode(
                    MessagingErrorCode.REGISTRATION_TOKEN_NOT_REGISTERED
                ));
        const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof error.code === 'string'
                ? error.code
                : 'unknownError';

        return {
            code,
            isInvalidToken,
            cause: error instanceof Error ? error : null,
        };
    }

    async onModuleInit(): Promise<void> {
        if (!this.projectId || !this.clientEmail || !this.privateKey) {
            this.logger.warn(
                'Firebase credentials not configured. Push notifications will be disabled.'
            );

            return;
        }

        try {
            this.app = firebaseAdmin.initializeApp({
                credential: firebaseAdmin.cert({
                    projectId: this.projectId,
                    clientEmail: this.clientEmail,
                    privateKey: this.privateKey,
                }),
            });

            this.messaging = getMessaging(this.app);

            this.logger.log('Firebase Admin SDK initialized successfully');
        } catch (error: unknown) {
            this.logger.error(error, 'Failed to initialize Firebase Admin SDK');
        }
    }

    isInitialized(): boolean {
        return !!this.app && !!this.messaging;
    }

    async sendPush(
        token: string,
        payload: IFirebasePushPayload
    ): Promise<boolean> {
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn('Firebase not initialized, skipping push');

            return false;
        }

        try {
            await this.messaging!.send({
                token,
                notification: {
                    title: payload.title,
                    body: payload.body,
                    imageUrl: payload.imageUrl,
                },
                data: payload.data,
            });

            return true;
        } catch (error: unknown) {
            const { isInvalidToken } = this.classifyError(error);

            if (isInvalidToken) {
                this.logger.warn(error, 'Invalid FCM token detected');
            } else {
                this.logger.error(error, 'Failed to send push notification');
            }

            return false;
        }
    }

    async sendMulticast(
        tokens: string[],
        payload: IFirebasePushPayload,
        chunkSize: number = FirebaseMaxSendPushBatchSize
    ): Promise<IFirebasePushResult> {
        if (
            !Number.isInteger(chunkSize) ||
            chunkSize < 1 ||
            chunkSize > FirebaseMaxSendPushBatchSize
        ) {
            throw new FirebaseChunkSizeInvalidException();
        }
        const uniqueTokens = [...new Set(tokens)];
        const isInitialized = this.isInitialized();
        if (!isInitialized) {
            this.logger.warn('Firebase not initialized, skipping multicast');
            const error = this.classifyError(
                new Error('Firebase not initialized')
            );
            return {
                successCount: 0,
                failureCount: uniqueTokens.length,
                failureTokens: [],
                failures: uniqueTokens.map(token => ({ token, error })),
            };
        }
        if (uniqueTokens.length === 0) {
            return {
                successCount: 0,
                failureCount: 0,
                failureTokens: [],
                failures: [],
            };
        }
        const chunkedTokens = this.helperArrayService.chunk(
            uniqueTokens,
            chunkSize
        );
        const promises = chunkedTokens.map(chunk =>
            this.messaging!.sendEachForMulticast({
                tokens: chunk,
                notification: {
                    title: payload.title,
                    body: payload.body,
                    imageUrl: payload.imageUrl,
                },
                data: payload.data,
            })
        );
        const responses = await Promise.allSettled(promises);
        let successCount = 0;
        const failures: IFirebasePushFailure[] = [];
        for (const [chunkIndex, response] of responses.entries()) {
            const chunk = chunkedTokens[chunkIndex];
            if (response.status === 'rejected') {
                const error = this.classifyError(response.reason);
                failures.push(...chunk.map(token => ({ token, error })));
                continue;
            }
            for (const [
                tokenIndex,
                result,
            ] of response.value.responses.entries()) {
                if (result.success) {
                    successCount++;
                } else {
                    const error = this.classifyError(result.error);
                    failures.push({ token: chunk[tokenIndex], error });
                }
            }
        }
        return {
            successCount,
            failureCount: failures.length,
            failureTokens: failures
                .filter(failure => failure.error.isInvalidToken)
                .map(failure => failure.token),
            failures,
        };
    }
}
