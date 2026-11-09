import { classifyAwsDeliveryError } from '@common/aws/utils/aws.delivery.util';

describe('classifyAwsDeliveryError', () => {
    it('returns unknownError and no cause for a non-Error', () => {
        expect(classifyAwsDeliveryError('boom')).toEqual({
            code: 'unknownError',
            cause: null,
        });
    });

    it('returns the error name as code and the error as cause', () => {
        const error = Object.assign(new Error('rate'), {
            name: 'ThrottlingException',
        });

        expect(classifyAwsDeliveryError(error)).toEqual({
            code: 'ThrottlingException',
            cause: error,
        });
    });
});
