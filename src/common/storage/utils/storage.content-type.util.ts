import { Injectable } from '@nestjs/common';
import Mime from 'mime';

/**
 * Maps file extensions onto the content types the storage kit signs, streams and verifies.
 */
@Injectable()
export class StorageContentTypeUtil {
    fromExtension(extension: string): string | null {
        return Mime.getType(extension);
    }

    /** The content type implied by the extension of the last key segment, or `null` when there is none or it has no mapping. */
    fromKey(key: string): string | null {
        const filename = key.slice(key.lastIndexOf('/') + 1);
        const dot = filename.lastIndexOf('.');
        if (dot === -1 || dot === filename.length - 1) {
            return null;
        }

        return this.fromExtension(filename.slice(dot + 1));
    }

    /** The distinct content types of the extensions that have a mapping. */
    fromExtensions(extensions: readonly string[]): string[] {
        const contentTypes = extensions
            .map(extension => this.fromExtension(extension))
            .filter(
                (contentType): contentType is string => contentType !== null
            );

        return [...new Set(contentTypes)];
    }
}
