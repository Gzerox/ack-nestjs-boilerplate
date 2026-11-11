import { registerAs } from '@nestjs/config';

export interface IConfigAws {
    ses: {
        iam: {
            key: string | null;
            secret: string | null;
            arn: string | null;
        };
        region: string | null;
    };
}

export default registerAs('aws', (): IConfigAws => ({
    ses: {
        iam: {
            key: process.env.AWS_SES_IAM_CREDENTIAL_KEY ?? null,
            secret: process.env.AWS_SES_IAM_CREDENTIAL_SECRET ?? null,
            arn: process.env.AWS_SES_IAM_ARN ?? null,
        },
        region: process.env.AWS_SES_REGION ?? null,
    },
}));
