import { EnumRequestStatusCodeError } from '@common/request/enums/request.status-code.enum';
import {
    ArgumentMetadata,
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import { PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * NestJS Pipe that validates UUID format for route parameters.
 * Used to validate ID parameters in API endpoints before they reach controllers.
 * Ensures only valid UUID strings are accepted.
 */
@Injectable()
export class RequestIsValidUuidPipe implements PipeTransform {
    /**
     * Validates that the input value is a valid UUID.
     * Throws BadRequestException if validation fails.
     *
     * @param {string} value - The input value to validate as UUID
     * @param {ArgumentMetadata} metadata - NestJS argument metadata with parameter name and type
     * @returns {string} The validated UUID string if valid
     * @throws {BadRequestException} If value is empty, not a string, or invalid UUID format
     */
    async transform(
        value: string,
        metadata: ArgumentMetadata
    ): Promise<string> {
        if (!value || typeof value !== 'string' || !isUUID(value, 'all')) {
            throw new BadRequestException({
                statusCode: EnumRequestStatusCodeError.validation,
                message: 'request.error.isUUID',
                messageProperties: {
                    property: metadata.data,
                },
            });
        }

        return value;
    }
}
