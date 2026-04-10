import {
    PipeTransform,
    UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnumRequestStatusCodeError } from '@common/request/enums/request.status-code.enum';

export class ParseJsonArrayPipe<T extends object>
    implements PipeTransform<string, Promise<T[]>>
{
    constructor(private readonly cls: new (...args: unknown[]) => T) {}

    async transform(value: string): Promise<T[]> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(value);
        } catch {
            throw new UnprocessableEntityException({
                statusCode: EnumRequestStatusCodeError.validation,
                message: 'request.error.validation',
            });
        }

        if (!Array.isArray(parsed)) {
            throw new UnprocessableEntityException({
                statusCode: EnumRequestStatusCodeError.validation,
                message: 'request.error.validation',
            });
        }

        const results: T[] = [];
        for (let i = 0; i < parsed.length; i++) {
            const instance = plainToInstance(this.cls, parsed[i]);
            const errors = await validate(instance as object);
            if (errors.length > 0) {
                throw new UnprocessableEntityException({
                    statusCode: EnumRequestStatusCodeError.validation,
                    message: 'request.error.validation',
                    data: errors.map(e => ({
                        index: i,
                        property: e.property,
                        constraints: e.constraints,
                    })),
                });
            }
            results.push(instance);
        }

        return results;
    }
}
