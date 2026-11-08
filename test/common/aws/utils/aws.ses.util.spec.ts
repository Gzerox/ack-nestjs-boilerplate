import { SESServiceException } from '@aws-sdk/client-ses';
import { isAwsSESDailyQuotaExceeded } from '@common/aws/utils/aws.ses.util';

describe('isAwsSESDailyQuotaExceeded', () => {
    it('is true for a Throttling error carrying the daily quota message', () => {
        const error = new SESServiceException({
            name: 'Throttling',
            message: 'Daily message quota exceeded.',
            $fault: 'client',
            $metadata: { httpStatusCode: 400 },
        });

        expect(isAwsSESDailyQuotaExceeded(error)).toBe(true);
    });

    it('is false for a Throttling error on the sending rate', () => {
        const error = new SESServiceException({
            name: 'Throttling',
            message: 'Maximum sending rate exceeded.',
            $fault: 'client',
            $metadata: { httpStatusCode: 400 },
        });

        expect(isAwsSESDailyQuotaExceeded(error)).toBe(false);
    });

    it('is false for a plain Error carrying the daily quota message', () => {
        const error = new Error('Daily message quota exceeded.');

        expect(isAwsSESDailyQuotaExceeded(error)).toBe(false);
    });

    it('is false for null', () => {
        expect(isAwsSESDailyQuotaExceeded(null)).toBe(false);
    });
});
