import { IRequestApp } from '@common/request/interfaces/request.interface';
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * Parameter decorator that extracts the survey recipient from the request context.
 */
export const SurveyCurrent = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): string | undefined => {
        const { __user } = ctx.switchToHttp().getRequest<IRequestApp>();
        return __user?.id;
    }
);
