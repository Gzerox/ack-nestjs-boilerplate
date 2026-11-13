import { z } from 'zod';
import { HealthResponseSchema } from '@modules/health/dtos/response/health.response.dto';
import {
    EnumHealthIndicatorStatus,
    EnumHealthStatus,
} from '@modules/health/enums/health.enum';

/**
 * Response shape of the AWS health check, which covers SES.
 * @public
 */
export const HealthAwsResponseSchema = HealthResponseSchema.extend({
    status: HealthResponseSchema.shape.status.meta({
        description: 'Overall health status of the AWS SES indicator',
        examples: Object.values(EnumHealthStatus),
    }),
    info: HealthResponseSchema.shape.info.meta({
        description: 'AWS indicators that reported up or degraded',
        example: {
            ses: {
                status: EnumHealthIndicatorStatus.up,
            },
        },
    }),
    error: HealthResponseSchema.shape.error.meta({
        description: 'AWS indicators that reported down',
        example: {
            ses: {
                status: EnumHealthIndicatorStatus.down,
            },
        },
    }),
    details: HealthResponseSchema.shape.details.meta({
        description: 'Combined AWS indicator results for this check',
        example: {
            ses: {
                status: EnumHealthIndicatorStatus.up,
            },
        },
    }),
});

/**
 * AWS health check result.
 * @public
 */
export type HealthAwsResponseDto = z.infer<typeof HealthAwsResponseSchema>;
