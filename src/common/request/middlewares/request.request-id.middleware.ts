import { IRequestApp } from '@common/request/interfaces/request.interface';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

/**
 * Middleware for generating and attaching request and correlation IDs.
 *
 * - Leaves `req.id` ownership to `pino-http` / `genReqId`.
 * - Normalizes correlation data so both `req.correlationId` and `x-correlation-id` are present.
 */
@Injectable()
export class RequestRequestIdMiddleware implements NestMiddleware {
    /**
     * Handles request and correlation ID assignment for each request.
     *
     * @param req - The Express request object
     * @param _res - The Express response object
     * @param next - The next middleware function
     *
     * - Sets `req.correlationId` from `x-correlation-id`.
     * - Falls back to `x-request-id`, then `req.id` when no correlation header is provided.
     * - Ensures the `x-correlation-id` header stays synchronized with request state.
     */
    use(req: IRequestApp, _res: Response, next: NextFunction): void {
        const correlationId =
            (typeof req.headers['x-correlation-id'] === 'string' &&
                req.headers['x-correlation-id']) ||
            (typeof req.headers['x-request-id'] === 'string' &&
                req.headers['x-request-id']) ||
            (typeof req.id === 'string' && req.id) ||
            '';

        req.correlationId = correlationId;
        req.headers['x-correlation-id'] = correlationId;

        next();
    }
}
