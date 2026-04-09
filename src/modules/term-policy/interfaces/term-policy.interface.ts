import {
    TermPolicy,
    TermPolicyContent,
    TermPolicyUserAcceptance,
    User,
} from '@generated/prisma-client';

export interface ITermPolicy extends TermPolicy {
    contents: TermPolicyContent[];
}

export interface ITermPolicyUserAcceptance extends TermPolicyUserAcceptance {
    user: User;
    termPolicy: ITermPolicy;
}
