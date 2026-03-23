/**
 * Default context string used for logger entries when no explicit context is provided.
 * Used to tag log messages with a generic context for easier filtering and searching.
 */
export const LoggerAutoContext = 'LoggerAutoContext';

/**
 * List of routes to be excluded from logging and monitoring.
 * These routes are typically health checks, documentation, or metrics endpoints
 * that do not require detailed logging or error tracking.
 *
 * Supports wildcard patterns for flexible matching.
 */
export const LoggerExcludedRoutes: string[] = [
    '/api/hello',
    '/api/hello/*',
    '/api/health',
    '/api/health/*',
    '/metrics',
    '/metrics/*',
    '/favicon.ico',
    '/docs',
    '/docs/*',
    '/',
] as const;

/**
 * List of HTTP header names used to extract or identify request IDs for tracing.
 * Checked in order to maintain request correlation across distributed systems.
 */
export const LoggerRequestIdHeaders = [
    'x-correlation-id',
    'x-request-id',
] as const;

/**
 * Request headers that are safe to include in logs.
 * All other headers are omitted by default to reduce noise and exposure risk.
 */
export const LoggerRequestHeadersAllowList = [
    'x-request-id',
    'x-correlation-id',
    'user-agent',
    'content-type',
    'accept-language',
    'referer',
] as const;

/**
 * Response headers that are safe to include in logs.
 * These headers are operationally useful and should not contain secrets.
 */
export const LoggerResponseHeadersAllowList = [
    'x-request-id',
    'x-correlation-id',
    'x-response-time',
    'content-type',
    'content-length',
] as const;

/**
 * List of object paths in request/response objects that may contain sensitive data.
 * Used by the logger redaction system to identify where sensitive fields might be located.
 */
export const LoggerSensitivePaths = [
    'req.headers',
    'res.headers',
    'request.headers',
    'response.headers',
];

/**
 * List of field names considered sensitive and subject to redaction in logs.
 * Includes authentication, credential, and personal data fields.
 */
export const LoggerSensitiveFields: string[] = [
    'password',
    'newPassword',
    'oldPassword',
    'token',
    'authorization',
    'bearer',
    'secret',
    'credential',
    'jwt',
    'x-api-key',
    'apiKey',
    'refreshToken',
    'accessToken',
    'sessionId',
    'privateKey',
    'secretKey',
    'otp',
    'recoveryCode',
    'location',
    'gps',
    'coordinates',
    'latitude',
    'longitude',
    'cookie',
    'cookies',
    'set-cookie',
];
