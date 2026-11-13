import { mock } from 'vitest-mock-extended';
import { EnumStorageVisibility } from '@generated/prisma-client/client';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { StorageServiceUnavailableException } from '@common/storage/exceptions/storage.service-unavailable.exception';
import { HealthStorageIndicator } from '@modules/health/indicators/health.storage.indicator';
import { createHealthIndicatorHarness } from '@test/modules/health/indicators/health.indicator.spec-helper';

describe('HealthStorageIndicator', () => {
    const objectStorageService = mock<ObjectStorageService>();

    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('isHealthy', () => {
        it('reports up under the key when the disk probe resolves', async () => {
            const { health, up } = createHealthIndicatorHarness();
            objectStorageService.probe.mockResolvedValue();
            const indicator = new HealthStorageIndicator(
                objectStorageService,
                health
            );

            await expect(
                indicator.isHealthy(
                    'storagePrivate',
                    EnumStorageVisibility.private
                )
            ).resolves.toBe(up);
            expect(health.check).toHaveBeenCalledWith('storagePrivate');
            expect(objectStorageService.probe).toHaveBeenCalledWith(
                EnumStorageVisibility.private
            );
        });

        it.each([
            [
                'the probe times out or the provider fails',
                new StorageServiceUnavailableException(
                    new Error('bucket ack-private at s3.eu-west-1 timed out')
                ),
            ],
            ['the probe throws an unexpected value', 'failure'],
        ])(
            'reports down with a sanitized message when %s',
            async (_case, error) => {
                const { health, session, down } =
                    createHealthIndicatorHarness();
                objectStorageService.probe.mockRejectedValue(error);
                const indicator = new HealthStorageIndicator(
                    objectStorageService,
                    health
                );

                await expect(
                    indicator.isHealthy(
                        'storagePublic',
                        EnumStorageVisibility.public
                    )
                ).resolves.toBe(down);
                expect(session.down).toHaveBeenCalledWith(
                    'HealthStorageIndicator Failed - public storage is unavailable'
                );
            }
        );
    });
});
