export interface IAwsDeliveryError {
    code: string;
    isRetryable: boolean;
    retryAfterInMs: number | null;
    cause: Error | null;
}
