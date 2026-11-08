import type { SdkError } from '@smithy/types';
import {
    isServerError,
    isThrottlingError,
    isTransientError,
} from '@smithy/core/retry';
import type { IAwsDeliveryError } from '@common/aws/interfaces/aws.delivery.interface';

export function toSdkError(error: Error, depth: number = 0): SdkError {
    return {
        ...error,
        name: error.name,
        message: error.message,
        cause:
            error.cause instanceof Error && depth < 10
                ? toSdkError(error.cause, depth + 1)
                : undefined,
    };
}

export function classifyAwsDeliveryError(error: unknown): IAwsDeliveryError {
    if (!(error instanceof Error)) {
        return {
            code: 'unknownError',
            isRetryable: false,
            retryAfterInMs: null,
            cause: null,
        };
    }

    const sdkError = toSdkError(error);
    const isRetryable =
        error.name !== 'AbortError' &&
        (isThrottlingError(sdkError) ||
            isTransientError(sdkError) ||
            isServerError(sdkError));

    return {
        code: error.name,
        isRetryable,
        retryAfterInMs: null,
        cause: error,
    };
}
