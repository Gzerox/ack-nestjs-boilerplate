import { EnumAppEnvironment } from '@app/enums/app.enum';
import { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';
import type { IMigrationUserData } from '@migration/interfaces/migration.interface';

export const MigrationUserSuperAdminId = '019a0000-0000-7000-8000-000000000001';

const UserData: IMigrationUserData[] = [
    {
        id: MigrationUserSuperAdminId,
        country: 'ID',
        email: 'superadmin@mail.com',
        username: 'superadmin',
        name: 'Super Admin',
        role: EnumRolePlatformKey.superAdmin,
        password: 'aaAA@123',
    },
    {
        id: null,
        country: 'ID',
        email: 'admin@mail.com',
        username: 'admin',
        name: 'Admin',
        role: EnumRolePlatformKey.admin,
        password: 'aaAA@123',
    },
];

export const MigrationUserData: Record<
    EnumAppEnvironment,
    IMigrationUserData[]
> = {
    [EnumAppEnvironment.local]: [
        ...UserData,
        {
            id: null,
            country: 'ID',
            email: 'user@mail.com',
            username: 'user',
            name: 'User',
            role: EnumRolePlatformKey.user,
            password: 'aaAA@123',
        },
    ],
    [EnumAppEnvironment.test]: [
        ...UserData,
        {
            id: null,
            country: 'ID',
            email: 'user@mail.com',
            username: 'user',
            name: 'User',
            role: EnumRolePlatformKey.user,
            password: 'aaAA@123',
        },
    ],
    [EnumAppEnvironment.development]: UserData,
    [EnumAppEnvironment.staging]: UserData,
    [EnumAppEnvironment.production]: UserData,
};
