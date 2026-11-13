import type { EnumStorageVisibility } from '@generated/prisma-client/client';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Reports one named storage disk as a Terminus health indicator, through the provider-neutral disk probe.
 */
@Injectable()
export class HealthStorageIndicator {
    constructor(
        private readonly objectStorageService: ObjectStorageService,
        private readonly healthIndicatorService: HealthIndicatorService
    ) {}

    /**
     * Down when the probe of the disk fails or times out; the message names the logical disk only, never the
     * bucket, the endpoint or the provider error.
     */
    async isHealthy(
        key: string,
        visibility: EnumStorageVisibility
    ): Promise<HealthIndicatorResult> {
        const indicator = this.healthIndicatorService.check(key);

        try {
            await this.objectStorageService.probe(visibility);

            return indicator.up();
        } catch {
            return indicator.down(
                `HealthStorageIndicator Failed - ${visibility} storage is unavailable`
            );
        }
    }
}
