import type { SdkError } from '@smithy/types';
import {
    isServerError,
    isThrottlingError,
    isTransientError,
} from '@smithy/core/retry';
import type { IAwsDeliveryError } from '@common/aws/interfaces/aws.delivery.interface';

export function classifyAwsDeliveryError(error: unknown): IAwsDeliveryError {
    const cause = error instanceof Error ? error : null;
    let isRetryable = false;
    let current = cause;
    // Smithy expects Error causes; arbitrary JavaScript causes must not enter its recursion.
    for (let depth = 0; current !== null && depth <= 10; depth++) {
        if (current.name === 'AbortError') {
            break;
        }
        const sdkError: SdkError = {
            ...current,
            name: current.name,
            message: current.message,
            cause: undefined,
        };
        if (
            isThrottlingError(sdkError) ||
            isTransientError(sdkError) ||
            isServerError(sdkError)
        ) {
            isRetryable = true;
            break;
        }
        current = current.cause instanceof Error ? current.cause : null;
    }
    return {
        code: cause?.name ?? 'unknownError',
        isRetryable,
        retryAfterInMs: null,
        cause,
    };
}
