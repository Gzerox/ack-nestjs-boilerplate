import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { IRequestApp } from '@common/request/interfaces/request.interface';

/**
 * Enriches request-scoped logs with `userId` after authentication has run.
 *
 * This interceptor exists because `pino-http` builds the request logger very
 * early in the request lifecycle. At that point `requestId` and
 * `correlationId` are already known, but authenticated user data is often not:
 * guards still need to parse the JWT and attach `request.user`.
 *
 * Why this is useful:
 * - controller/service logs emitted after auth can still be queried by user
 * - authenticated requests get a stable `userId` on downstream log lines
 * - public or unauthenticated routes remain unchanged
 *
 * Why the formatter is not enough:
 * - the formatter can only reshape fields that are already present on a log
 *   record
 * - it cannot retroactively bind `userId` into the request-scoped logger once
 *   the logger has already been created without it
 */
@Injectable()
export class RequestLoggerContextInterceptor implements NestInterceptor {
    constructor(private readonly logger: PinoLogger) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler
    ): Observable<unknown> {
        if (context.getType<'http'>() !== 'http') {
            return next.handle();
        }

        const request: IRequestApp = context.switchToHttp().getRequest();
        const userId = (request.user as { userId?: string } | undefined)?.userId;

        if (userId) {
            this.logger.assign({ userId });
        }

        return next.handle();
    }
}
