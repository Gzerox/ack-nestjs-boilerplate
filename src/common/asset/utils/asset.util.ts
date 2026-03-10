import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class AssetUtil {
    generateChecksum(buffer: Buffer): string {
        return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    }
}
