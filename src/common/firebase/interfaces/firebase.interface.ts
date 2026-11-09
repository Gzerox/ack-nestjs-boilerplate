export interface IFirebasePushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
}

export interface IFirebasePushResult {
    successCount: number;
    failureCount: number;
    failureTokens: string[];
    failures: IFirebasePushFailure[];
}

export interface IFirebaseDeliveryError {
    code: string;
    isInvalidToken: boolean;
    cause: Error | null;
}

export interface IFirebasePushFailure {
    token: string;
    error: IFirebaseDeliveryError;
}
