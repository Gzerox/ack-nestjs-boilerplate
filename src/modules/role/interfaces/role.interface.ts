import { EnumRoleType, Role, RoleAbility } from '@generated/prisma-client';

export interface IRole {
    id: string;
    type: EnumRoleType;
    name: string;
}

export interface IRoleWithAbilities extends Role {
    abilities: RoleAbility[];
}
