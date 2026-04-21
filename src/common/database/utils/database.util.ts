import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-client';
import { randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';

/**
 * Database utility service providing common database operations.
 *
 * This injectable service provides utility methods for database-related operations,
 * including ID generation and typed JSON serialization for JSON-backed fields.
 *
 * @class DatabaseUtil
 * @injectable
 */
@Injectable()
export class DatabaseUtil {
    /**
     * Checks if the provided ID string is a valid UUID.
     *
     * @param {string} id - The ID string to validate
     * @returns {boolean} True if the ID is a valid UUID, false otherwise
     */
    checkIdIsValid(id: string): boolean {
        return isUUID(id, 'all');
    }

    /**
     * Creates a new unique identifier using UUID format.
     *
     * @returns {string} UUID string representation
     */
    createId(): string {
        return randomUUID();
    }

    /**
     * Converts the provided data to a plain object compatible with Prisma JsonObject format.
     *
     * Performs a deep clone of the input and casts it to Prisma.JsonObject, ensuring
     * compatibility for Prisma JSON fields.
     *
     * @template T Input data type
     * @template N Output type, defaults to Prisma.JsonObject
     * @param {T} data - The data to convert
     * @returns {N} The plain object representation, compatible with Prisma JsonObject
     */
    toPlainObject<T, N = Prisma.JsonObject>(data: T): N {
        return structuredClone(data as unknown) as N;
    }

    /**
     * Converts the provided data to a plain array compatible with Prisma JsonObject array format.
     *
     * Performs a deep clone of the input and casts it to an array of Prisma.JsonObject,
     * making it suitable for Prisma JSON array fields.
     *
     * @template T Input data type
     * @template N Output array element type, defaults to Prisma.JsonObject
     * @param {T} data - The data to convert
     * @returns {N[]} The plain array representation, compatible with Prisma JsonObject[]
     */
    toPlainArray<T, N = Prisma.JsonObject>(data: T): N[] {
        return structuredClone(data) as N[];
    }

}
