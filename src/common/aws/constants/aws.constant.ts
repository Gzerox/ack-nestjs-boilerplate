/**
 * Maximum SES sends per rate-limit window of the email worker, a safe margin under the SES 15/sec cap.
 * @public
 */
export const AwsSESRateLimitPerDuration = 10;
/**
 * Rate-limit window of the email worker, paired with `AwsSESRateLimitPerDuration`.
 * @public
 */
export const AwsSESRateLimitDurationInMs = 1000;
