/**
 * FCM hard limit of tokens per `sendEachForMulticast` call.
 * @public
 */
export const FirebaseMaxSendPushBatchSize = 500;

/**
 * Max push messages per rate-limit window, kept safely under FCM's 600k/min project limit.
 * @public
 */
export const FirebaseMaxRateLimitPerDuration = 500000;

/**
 * Rate-limit window in ms (1 minute), paired with `FirebaseMaxRateLimitPerDuration`.
 * @public
 */
export const FirebaseRateLimitDurationInMs = 60000;

/**
 * Marker whose presence means the raw private key is already PEM framed.
 * @public
 */
export const FirebasePrivateKeyPemMarker = '-----BEGIN';
