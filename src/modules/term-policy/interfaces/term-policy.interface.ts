import {
    TermPolicy,
    TermPolicyContent,
    TermPolicyUserAcceptance,
    User,
} from '@generated/prisma-client';

export interface ITermPolicyUserAcceptance extends TermPolicyUserAcceptance {
    user: User;
    termPolicy: TermPolicy;
}

export interface ITermPolicyWithContents extends TermPolicy {
    contents: TermPolicyContent[];
}

export interface ITermPolicyExist {
    id: TermPolicy['id'];
    status: TermPolicy['status'];
}
