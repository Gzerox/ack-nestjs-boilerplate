import type { INotificationDeliveryFailure } from '@modules/notification/interfaces/notification.interface';
import { HttpStatus } from '@nestjs/common';
import { AppBaseException } from '@app/exceptions/app.base.exception';
import { EnumNotificationStatusCodeError } from '@modules/notification/enums/notification.status-code.enum';

/**
 * Raised when delivery fails, retaining the failure code and the original diagnostic cause.
 * @public
 */
export class NotificationDeliveryFailedException extends AppBaseException {
    readonly module = 'notification';
    readonly statusCode = EnumNotificationStatusCodeError.deliveryFailed;
    readonly statusCodeKey = EnumNotificationStatusCodeError[this.statusCode];
    readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

    constructor(failure: INotificationDeliveryFailure) {
        super('notification.error.deliveryFailed', {
            messageProperties: { cause: failure.code },
            rawError: failure.cause,
        });
    }
}
