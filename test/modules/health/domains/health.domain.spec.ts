import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { HealthDomain } from '@modules/health/domains/health.domain';
import { HealthAppleIndicator } from '@modules/health/indicators/health.apple.indicator';
import { HealthStorageIndicator } from '@modules/health/indicators/health.storage.indicator';
import { HealthAwsSESIndicator } from '@modules/health/indicators/health.aws-ses.indicator';
import { HealthDatabaseIndicator } from '@modules/health/indicators/health.database.indicator';
import { HealthFirebaseIndicator } from '@modules/health/indicators/health.firebase.indicator';
import { HealthGoogleIndicator } from '@modules/health/indicators/health.google.indicator';
import { HealthInstanceIndicator } from '@modules/health/indicators/health.instance.indicator';
import { HealthJwksIndicator } from '@modules/health/indicators/health.jwks.indicator';
import { HealthQueueIndicator } from '@modules/health/indicators/health.queue.indicator';
import { HealthRedisIndicator } from '@modules/health/indicators/health.redis.indicator';
import { HealthSentryIndicator } from '@modules/health/indicators/health.sentry.indicator';
import { HealthCheckService } from '@nestjs/terminus';

vi.mock('@common/firebase/services/firebase.service', () => ({
    FirebaseService: class {},
}));

vi.mock('@modules/health/indicators/health.sentry.indicator', () => ({
    HealthSentryIndicator: class {},
}));

describe('HealthDomain', () => {
    const health: MockProxy<HealthCheckService> = mock<HealthCheckService>();
    const instance = mock<HealthInstanceIndicator>();
    const storage = mock<HealthStorageIndicator>();
    const ses = mock<HealthAwsSESIndicator>();
    const database = mock<HealthDatabaseIndicator>();
    const redis = mock<HealthRedisIndicator>();
    const sentry = mock<HealthSentryIndicator>();
    const firebase = mock<HealthFirebaseIndicator>();
    const google = mock<HealthGoogleIndicator>();
    const apple = mock<HealthAppleIndicator>();
    const jwks = mock<HealthJwksIndicator>();
    const queue = mock<HealthQueueIndicator>();
    const result = { status: 'ok', info: {}, error: {}, details: {} } as never;
    const domain = new HealthDomain(
        health,
        instance,
        storage,
        ses,
        database,
        redis,
        sentry,
        firebase,
        google,
        apple,
        jwks,
        queue
    );

    beforeEach(() => {
        vi.resetAllMocks();
        health.check.mockImplementation(async checks => {
            for (const check of checks) {
                if (typeof check === 'function') {
                    await check();
                }
            }
            return result;
        });
    });

    it('checks SES only on the AWS check', async () => {
        await expect(domain.checkAws()).resolves.toBe(result);
        expect(ses.isHealthy).toHaveBeenCalledWith('ses');
        expect(storage.isHealthy).not.toHaveBeenCalled();
    });

    it('checks both storage disks with their logical keys', async () => {
        await expect(domain.checkStorage()).resolves.toBe(result);
        expect(storage.isHealthy).toHaveBeenNthCalledWith(
            1,
            'storagePublic',
            EnumStorageVisibility.public
        );
        expect(storage.isHealthy).toHaveBeenNthCalledWith(
            2,
            'storagePrivate',
            EnumStorageVisibility.private
        );
    });

    it('checks database dependencies with exact keys', async () => {
        await expect(domain.checkDatabase()).resolves.toBe(result);
        expect(database.isHealthy).toHaveBeenCalledWith('database');
        expect(redis.isHealthy).toHaveBeenCalledWith('redis');
        expect(queue.isHealthy).toHaveBeenCalledWith('queue');
    });

    it('checks third-party dependencies with exact keys', async () => {
        await expect(domain.checkThirdParty()).resolves.toBe(result);
        expect(sentry.isHealthy).toHaveBeenCalledWith('sentry');
        expect(firebase.isHealthy).toHaveBeenCalledWith('firebase');
        expect(google.isHealthy).toHaveBeenCalledWith('google');
        expect(apple.isHealthy).toHaveBeenCalledWith('apple');
        expect(jwks.isHealthyAccessToken).toHaveBeenCalledWith(
            'jwksAccessToken'
        );
        expect(jwks.isHealthyRefreshToken).toHaveBeenCalledWith(
            'jwksRefreshToken'
        );
    });

    it('checks instance resources with exact keys', async () => {
        await expect(domain.checkInstance()).resolves.toBe(result);
        expect(instance.isHealthyMemoryRss).toHaveBeenCalledWith('memoryRss');
        expect(instance.isHealthyMemoryHeap).toHaveBeenCalledWith('memoryHeap');
        expect(instance.isHealthyStorage).toHaveBeenCalledWith('storage');
    });
});
