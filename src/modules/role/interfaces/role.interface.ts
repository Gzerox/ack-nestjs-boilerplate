import type { EnumRoleScope } from '@generated/prisma-client/client';
import type { Policy, Prisma, Role } from '@generated/prisma-client/client';
import type {
    RoleSharedListSelect,
    RoleShortSelect,
} from '@modules/role/constants/role.constant';

export interface IRole {
    id: string;
    scope: EnumRoleScope;
    key: string;
    name: string;
}

export type IRoleWithPolicies = Role & {
    policies: Policy[];
};

export type IRoleWithPolicyCount = Role & {
    _count: { policies: number };
};

export interface IRoleUpdate {
    name: string;
    description?: string;
}

export type IRoleSharedList = Prisma.RoleGetPayload<{
    select: typeof RoleSharedListSelect;
}>;

export type IRoleShort = Prisma.RoleGetPayload<{
    select: typeof RoleShortSelect;
}>;
