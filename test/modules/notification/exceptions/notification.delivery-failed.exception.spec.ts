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
                cause,
            });
            expect(exception).toMatchObject({
                rawError: cause,
                messageProperties: { cause: 'Throttling' },
            });
            expect(exception.message).not.toContain(cause.message);
        });
        it('exposes its fields and the cause as a message property', () => {
            const exception = new NotificationDeliveryFailedException({
                code: 'MessageRejected',
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
            });
        });
    });
});
