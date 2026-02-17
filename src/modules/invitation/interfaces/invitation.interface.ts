import { EnumRoleScope } from '@prisma/client';

export type InvitationType = 'project_member' | 'tenant_member';

export interface InvitationContext {
    invitationType: InvitationType;
    roleScope: EnumRoleScope;
    scopeLabel: string;
    contextId: string;
    contextName: string;
}

export interface InvitationMembershipGateway {
    roleScope: EnumRoleScope;
    existsMember(
        contextId: string,
        userId: string
    ): Promise<boolean>;
    addMember(
        contextId: string,
        userId: string,
        roleId: string,
        createdBy: string
    ): Promise<string>;
    findMemberUserId(
        contextId: string,
        memberId: string
    ): Promise<string | null>;
}

export interface InvitationContextProvider {
    invitationType: InvitationType;
    scopeLabel: string;
    getContextName(contextId: string): Promise<string | null>;
}

export interface InvitationProvider
    extends InvitationMembershipGateway,
        InvitationContextProvider {}
