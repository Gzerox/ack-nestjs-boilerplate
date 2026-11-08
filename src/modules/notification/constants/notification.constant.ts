/**
 * HKDF purpose that seals secrets inside queued notification jobs.
 * @public
 */
export const NotificationPayloadEncryptionPurpose = 'notification.payload';

/**
 * BullMQ backoff strategy for push delivery.
 * @public
 */
export const NotificationPushBackoffType = 'notificationPush';
