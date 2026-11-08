import {
    classifyAwsDeliveryError,
    toSdkError,
} from '@common/aws/utils/aws.delivery.util';

describe('toSdkError', () => {
    it('carries the AWS fields of the error', () => {
        const error = Object.assign(new Error('rate'), {
            name: 'ThrottlingException',
            code: 'ThrottlingException',
            $retryable: { throttling: true },
            $metadata: { httpStatusCode: 400 },
            $fault: 'client' as const,
        });

        expect(toSdkError(error)).toEqual({
            name: 'ThrottlingException',
            message: 'rate',
            code: 'ThrottlingException',
            $retryable: { throttling: true },
            $metadata: { httpStatusCode: 400 },
            $fault: 'client',
            cause: undefined,
        });
    });

    it('turns a non-Error cause into undefined', () => {
        const error = new Error('malformed cause', { cause: 'opaque' });

        expect(toSdkError(error).cause).toBeUndefined();
    });

    it('converts an Error cause recursively', () => {
        const error = new Error('wrapped', {
            cause: Object.assign(new Error('socket'), { code: 'ETIMEDOUT' }),
        });

        expect(toSdkError(error).cause).toEqual({
            name: 'Error',
            message: 'socket',
            code: 'ETIMEDOUT',
            cause: undefined,
        });
    });

    it('stops the cause chain at depth 10', () => {
        let chain = new Error('root');
        for (let index = 1; index < 12; index++) {
            chain = new Error(`level ${index}`, { cause: chain });
        }

        let current: unknown = toSdkError(chain);
        let depth = 0;
        while (current instanceof Object && 'cause' in current) {
            current = current.cause;
            depth++;
        }

        expect(depth).toBe(11);
        expect(current).toBeUndefined();
    });
});

describe('classifyAwsDeliveryError', () => {
    it('returns unknownError and no retry for a non-Error', () => {
        expect(classifyAwsDeliveryError('boom')).toEqual({
            code: 'unknownError',
            isRetryable: false,
            retryAfterInMs: null,
            cause: null,
        });
    });

    it('does not retry an AbortError carrying a 503 and retry metadata', () => {
        const error = Object.assign(new Error('abort'), {
            name: 'AbortError',
            $retryable: {},
            $metadata: { httpStatusCode: 503 },
        });

        expect(classifyAwsDeliveryError(error)).toEqual({
            code: 'AbortError',
            isRetryable: false,
            retryAfterInMs: null,
            cause: error,
        });
    });

    it('retries a wrapped ETIMEDOUT cause', () => {
        const error = new Error('wrapped', {
            cause: Object.assign(new Error('socket'), { code: 'ETIMEDOUT' }),
        });

        expect(classifyAwsDeliveryError(error)).toEqual({
            code: 'Error',
            isRetryable: true,
            retryAfterInMs: null,
            cause: error,
        });
    });

    it('does not retry nor throw on a null or opaque cause', () => {
        const errors = [
            new Error('malformed cause', { cause: null }),
            new Error('malformed cause', { cause: 'opaque' }),
        ];
        for (const error of errors) {
            expect(classifyAwsDeliveryError(error)).toEqual({
                code: 'Error',
                isRetryable: false,
                retryAfterInMs: null,
                cause: error,
            });
        }
    });

    it('retries a server fault', () => {
        const error = Object.assign(new Error('server'), {
            name: 'ServiceFailure',
            $fault: 'server' as const,
            $metadata: { httpStatusCode: 500 },
        });

        expect(classifyAwsDeliveryError(error).isRetryable).toBe(true);
    });

    it('retries a throttling error', () => {
        const error = Object.assign(new Error('rate'), {
            name: 'ThrottlingException',
        });

        expect(classifyAwsDeliveryError(error).isRetryable).toBe(true);
    });
});
