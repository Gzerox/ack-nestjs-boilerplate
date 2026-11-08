import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';

describe('NotificationDeliveryFailedException', () => {
    describe('constructor', () => {
        it('retains provider diagnostics outside its safe message', () => {
            const cause = new Error('sensitive provider detail');
            const exception = new NotificationDeliveryFailedException({
                code: 'Throttling',
                isRetryable: true,
                retryAfterInMs: 90000,
                cause,
            });
            expect(exception).toMatchObject({
                isRetryable: true,
                retryAfterInMs: 90000,
                rawError: cause,
                messageProperties: { cause: 'Throttling' },
            });
            expect(exception.message).not.toContain(cause.message);
        });
        it('exposes its five fields and the cause as a message property', () => {
            const exception = new NotificationDeliveryFailedException({
                code: 'MessageRejected',
                isRetryable: false,
                retryAfterInMs: null,
                cause: null,
            });

            expect(exception).toBeInstanceOf(AppBaseException);
            expect(exception).toMatchObject({
                module: 'notification',
                statusCode: EnumNotificationStatusCodeError.deliveryFailed,
                statusCodeKey:
                    EnumNotificationStatusCodeError[
                        EnumNotificationStatusCodeError.deliveryFailed
                    ],
                httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
                messagePath: 'notification.error.deliveryFailed',
                messageProperties: { cause: 'MessageRejected' },
                isRetryable: false,
                retryAfterInMs: null,
            });
        });
    });
});
