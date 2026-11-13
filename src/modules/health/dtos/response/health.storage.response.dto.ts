import { z } from 'zod';
import { HealthResponseSchema } from '@modules/health/dtos/response/health.response.dto';
import {
    EnumHealthIndicatorStatus,
    EnumHealthStatus,
} from '@modules/health/enums/health.enum';

/**
 * Response shape of the storage health check: one indicator per named disk.
 * @public
 */
export const HealthStorageResponseSchema = HealthResponseSchema.extend({
    status: HealthResponseSchema.shape.status.meta({
        description: 'Overall health status of the storage disks',
        examples: Object.values(EnumHealthStatus),
    }),
    info: HealthResponseSchema.shape.info.meta({
        description: 'Storage disk indicators that reported up or degraded',
        example: {
            storagePublic: {
                status: EnumHealthIndicatorStatus.up,
            },
            storagePrivate: {
                status: EnumHealthIndicatorStatus.up,
            },
        },
    }),
    error: HealthResponseSchema.shape.error.meta({
        description: 'Storage disk indicators that reported down',
        example: {
            storagePublic: {
                status: EnumHealthIndicatorStatus.down,
            },
            storagePrivate: {
                status: EnumHealthIndicatorStatus.down,
            },
        },
    }),
    details: HealthResponseSchema.shape.details.meta({
        description: 'Combined storage disk indicator results for this check',
        example: {
            storagePublic: {
                status: EnumHealthIndicatorStatus.up,
            },
            storagePrivate: {
                status: EnumHealthIndicatorStatus.up,
            },
        },
    }),
});

/**
 * Storage health check result.
 * @public
 */
export type HealthStorageResponseDto = z.infer<
    typeof HealthStorageResponseSchema
>;
