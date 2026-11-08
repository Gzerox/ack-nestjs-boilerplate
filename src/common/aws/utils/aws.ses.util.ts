import { SESServiceException } from '@aws-sdk/client-ses';
import { isThrottlingError } from '@smithy/core/retry';
import { AwsSESDailyQuotaExceededMessage } from '@common/aws/constants/aws.constant';
import { toSdkError } from '@common/aws/utils/aws.delivery.util';

export function isAwsSESDailyQuotaExceeded(error: unknown): boolean {
    return (
        error instanceof SESServiceException &&
        isThrottlingError(toSdkError(error)) &&
        error.message.includes(AwsSESDailyQuotaExceededMessage)
    );
}
