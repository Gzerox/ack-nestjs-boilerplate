import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HelperNumberService } from '@common/helper/services/helper.number.service';
import type { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';

@Injectable()
export class NotificationRetryUtil {
    constructor(
        private readonly configService: ConfigService,
        private readonly helperNumberService: HelperNumberService
    ) {}
    delay(
        attemptsMade: number,
        failure: NotificationDeliveryFailedException | null
    ): number {
        const minimum = this.configService.get<number>(
            'queue.job.pushBackoffDelayInMs'
        )!;
        const maximum = this.configService.get<number>(
            'queue.job.pushMaxBackoffDelayInMs'
        )!;
        const ratio = this.configService.get<number>(
            'queue.job.pushBackoffJitterRatio'
        )!;
        const base = Math.min(
            maximum,
            minimum * 2 ** Math.max(0, attemptsMade - 1)
        );
        const hint = failure?.retryAfterInMs;
        const providerDelay =
            typeof hint === 'number' && Number.isFinite(hint) && hint >= 0
                ? hint
                : 0;
        const lowerBound = Math.max(minimum, base, providerDelay);
        const jitter = this.helperNumberService.randomInRange(
            0,
            Math.floor(lowerBound * ratio) + 1
        );
        return lowerBound + jitter;
    }
}
