import { registerAs } from '@nestjs/config';

export interface IConfigDoc {
    enabled: boolean;
    auth: {
        enabled: boolean;
        username: string | null;
        password: string | null;
    };
    name: string;
    prefix: string;
    version: string;
    jsonUrlPattern: string;
}

export default registerAs('doc', (): IConfigDoc => ({
    enabled: process.env.DOC_ENABLED !== 'false',
    auth: {
        enabled: process.env.DOC_AUTH_ENABLED === 'true',
        username: process.env.DOC_AUTH_USERNAME ?? null,
        password: process.env.DOC_AUTH_PASSWORD ?? null,
    },
    name: `${process.env.APP_NAME!} APIs Specification`,
    prefix: '/docs',
    version: '3.1.0',
    jsonUrlPattern: '{docPrefix}/json',
}));
