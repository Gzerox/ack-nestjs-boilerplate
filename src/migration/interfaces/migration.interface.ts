import type {
    EnumPolicyAction,
    EnumPolicySubject,
    EnumRoleScope,
} from '@generated/prisma-client/client';
import { EnumMigrationType } from '@migration/enums/migration.enum';
import type { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';

export interface IMigrationOptions {
    type: EnumMigrationType;
}

export interface IMigrationUserData {
    id: string | null;
    country: string;
    email: Lowercase<string>;
    username: Lowercase<string>;
    name: string;
    role: EnumRolePlatformKey;
    password: string;
}

export interface IMigrationPolicyData {
    scope: EnumRoleScope;
    key: string;
    policies: {
        subject: EnumPolicySubject;
        action: EnumPolicyAction[];
    }[];
}
