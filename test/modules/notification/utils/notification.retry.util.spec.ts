import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Backoffs } from 'bullmq';
import type { MinimalJob } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { HelperNumberService } from '@common/helper/services/helper.number.service';
import { NotificationDeliveryFailedException } from '@modules/notification/exceptions/notification.delivery-failed.exception';
import { NotificationRetryUtil } from '@modules/notification/utils/notification.retry.util';
import { NotificationPushBackoffType } from '@modules/notification/constants/notification.constant';

describe('NotificationRetryUtil', () => {
    const configService = mock<ConfigService>();
    const helperNumberService = mock<HelperNumberService>();
    let util: NotificationRetryUtil;
    beforeEach(async () => {
        vi.resetAllMocks();
        vi.mocked(configService.get).mockImplementation((key: string) => {
            const values: Record<string, unknown> = {
                'queue.job.pushBackoffDelayInMs': 10000,
                'queue.job.pushMaxBackoffDelayInMs': 60000,
                'queue.job.pushBackoffJitterRatio': 0.2,
            };
            return values[key];
        });
        const module = await Test.createTestingModule({
            providers: [
                NotificationRetryUtil,
                { provide: ConfigService, useValue: configService },
                { provide: HelperNumberService, useValue: helperNumberService },
            ],
        }).compile();
        util = module.get(NotificationRetryUtil);
    });
    it.each([
        [1, 10000, 2000],
        [2, 20000, 4000],
        [4, 60000, 12000],
        [20, 60000, 12000],
    ])(
        'uses a bounded exponential base at attempt %s with additive jitter',
        (attempts, lower, jitter) => {
            helperNumberService.randomInRange
                .mockReturnValueOnce(0)
                .mockReturnValueOnce(jitter);
            expect(util.delay(attempts, null)).toBe(lower);
            expect(util.delay(attempts, null)).toBe(lower + jitter);
            expect(helperNumberService.randomInRange).toHaveBeenCalledWith(
                0,
                jitter + 1
            );
        }
    );
    it.each([
        [60000, 60000],
        [120000, 120000],
        [-1, 10000],
        [NaN, 10000],
    ])('respects normalized hint %s with a floor of %s', (hint, expected) => {
        const failure = new NotificationDeliveryFailedException({
            code: 'messaging/server-unavailable',
            isRetryable: true,
            retryAfterInMs: hint,
            cause: null,
        });
        helperNumberService.randomInRange.mockReturnValue(0);
        expect(util.delay(1, failure)).toBe(expected);
    });
    it('dispatches the named strategy through BullMQ Backoffs', async () => {
        const failure = new NotificationDeliveryFailedException({
            code: 'quota',
            isRetryable: true,
            retryAfterInMs: 120000,
            cause: null,
        });
        const job = mock<MinimalJob>();
        helperNumberService.randomInRange.mockReturnValue(0);
        const result = await Backoffs.calculate(
            { type: NotificationPushBackoffType },
            1,
            failure,
            job,
            (attempts, _type, error) =>
                util.delay(
                    attempts,
                    error instanceof NotificationDeliveryFailedException
                        ? error
                        : null
                )
        );
        expect(result).toBe(120000);
    });
});
