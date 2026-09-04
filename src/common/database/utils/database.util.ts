import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { v7, validate } from 'uuid';

/**
 * UUID helpers and deep-clone casts to Prisma JSON input types.
 */
@Injectable()
export class DatabaseUtil {
    checkIdIsValid(id: string): boolean {
        return validate(id);
    }

    createId(): string {
        return v7();
    }

    /**
     * Deep-clones `data` and casts it to a Prisma-compatible plain object.
     * `null` is converted to JSON null because Prisma JSON writes reserve raw
     * null for nullable-column ambiguity.
     */
    toPlainObject<T, N = Prisma.JsonObject>(data: T): N {
        if (data === null) {
            return Prisma.JsonNull as N;
        }

        return structuredClone(data as unknown) as N;
    }

    /**
     * Deep-clones `data` and casts it to a Prisma-compatible plain array.
     */
    toPlainArray<T, N = Prisma.JsonObject>(data: T): N[] {
        return structuredClone(data) as N[];
    }
}
