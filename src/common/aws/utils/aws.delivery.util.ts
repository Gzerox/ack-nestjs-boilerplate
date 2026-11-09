import type { IAwsDeliveryError } from '@common/aws/interfaces/aws.delivery.interface';

export function classifyAwsDeliveryError(error: unknown): IAwsDeliveryError {
    if (!(error instanceof Error)) {
        return { code: 'unknownError', cause: null };
    }

    return { code: error.name, cause: error };
}
