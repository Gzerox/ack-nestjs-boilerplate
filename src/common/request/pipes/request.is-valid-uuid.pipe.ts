import { RequestIsUuidException } from '@common/request/exceptions/request.is-uuid.exception';
import { ArgumentMetadata, Injectable } from '@nestjs/common';
import { PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Validates a route param is a UUID; throws 400 otherwise.
 */
@Injectable()
export class RequestIsValidUuidPipe implements PipeTransform {
    async transform(
        value: string,
        metadata: ArgumentMetadata
    ): Promise<string> {
        if (!value || typeof value !== 'string' || !isUUID(value)) {
            throw new RequestIsUuidException(metadata.data!);
        }

        return value;
    }
}
