import { registerAs } from '@nestjs/config';
import bytes from 'bytes';

export interface IConfigTermPolicy {
    draftPrefixPattern: string;
    contentScopePrefixPattern: string;
    content: {
        maxSizeInBytes: number;
    };
}

export default registerAs('termPolicy', (): IConfigTermPolicy => ({
    draftPrefixPattern: 'term-policies/{type}/v{version}/',
    contentScopePrefixPattern: 'term-policies/{type}/v{version}/{language}/',
    content: {
        maxSizeInBytes: bytes('1mb')!,
    },
}));
