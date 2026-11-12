import { registerAs } from '@nestjs/config';
import bytes from 'bytes';

export interface IConfigTermPolicy {
    prefixPattern: string;
    contentScopePrefixPattern: string;
    content: {
        maxSizeInBytes: number;
    };
}

export default registerAs('termPolicy', (): IConfigTermPolicy => ({
    prefixPattern: 'term-policies/{type}/v{version}/',
    contentScopePrefixPattern: 'term-policies/{type}/v{version}/{language}/',
    content: {
        maxSizeInBytes: bytes('1mb')!,
    },
}));
