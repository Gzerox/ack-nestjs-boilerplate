import type { Prisma } from '@generated/prisma-client/client';

/**
 * HKDF purpose that seals secrets inside queued notification jobs.
 * @public
 */
export const NotificationPayloadEncryptionPurpose = 'notification.payload';

/**
 * Prisma select for the content a delivery attempt needs.
 * @public
 */
export const NotificationDeliveryContentSelect = {
    failureTokens: true,
    notification: { select: { title: true, body: true } },
} satisfies Prisma.NotificationDeliverySelect;
