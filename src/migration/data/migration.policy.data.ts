import { EnumAppEnvironment } from '@app/enums/app.enum';
import {
    EnumPolicyAction,
    EnumPolicySubject,
    EnumRoleScope,
} from '@generated/prisma-client/client';
import type { IMigrationPolicyData } from '@migration/interfaces/migration.interface';
import { EnumRolePlatformKey } from '@modules/role/enums/role.platform-key.enum';
import { EnumRoleProjectKey } from '@modules/role/enums/role.project-key.enum';
import { EnumRoleWorkspaceKey } from '@modules/role/enums/role.workspace-key.enum';

const PlatformAdminSubjects: EnumPolicySubject[] = [
    EnumPolicySubject.activityLog,
    EnumPolicySubject.analytic,
    EnumPolicySubject.apiKey,
    EnumPolicySubject.device,
    EnumPolicySubject.featureFlag,
    EnumPolicySubject.passwordHistory,
    EnumPolicySubject.role,
    EnumPolicySubject.session,
    EnumPolicySubject.termPolicy,
    EnumPolicySubject.user,
];

const PolicyData: IMigrationPolicyData[] = [
    {
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.superAdmin,
        policies: [
            {
                subject: EnumPolicySubject.all,
                action: [EnumPolicyAction.manage],
            },
        ],
    },
    {
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.admin,
        policies: [
            ...PlatformAdminSubjects.map(subject => ({
                subject,
                action: Object.values(EnumPolicyAction),
            })),
            {
                subject: EnumPolicySubject.workspace,
                action: [EnumPolicyAction.read],
            },
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.read],
            },
        ],
    },
    {
        scope: EnumRoleScope.platform,
        key: EnumRolePlatformKey.user,
        policies: [],
    },
    {
        scope: EnumRoleScope.workspace,
        key: EnumRoleWorkspaceKey.owner,
        policies: [
            {
                subject: EnumPolicySubject.workspace,
                action: [EnumPolicyAction.manage],
            },
            {
                subject: EnumPolicySubject.workspaceMember,
                action: [EnumPolicyAction.update, EnumPolicyAction.delete],
            },
            {
                subject: EnumPolicySubject.workspaceInvite,
                action: [EnumPolicyAction.manage],
            },
            {
                subject: EnumPolicySubject.workspaceJoinRequest,
                action: [EnumPolicyAction.update],
            },
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.manage],
            },
            {
                subject: EnumPolicySubject.projectMember,
                action: [EnumPolicyAction.manage],
            },
            {
                subject: EnumPolicySubject.analytic,
                action: [EnumPolicyAction.read],
            },
        ],
    },
    {
        scope: EnumRoleScope.workspace,
        key: EnumRoleWorkspaceKey.admin,
        policies: [
            {
                subject: EnumPolicySubject.workspace,
                action: [EnumPolicyAction.read, EnumPolicyAction.update],
            },
            {
                subject: EnumPolicySubject.workspaceMember,
                action: [EnumPolicyAction.update, EnumPolicyAction.delete],
            },
            {
                subject: EnumPolicySubject.workspaceInvite,
                action: [EnumPolicyAction.manage],
            },
            {
                subject: EnumPolicySubject.workspaceJoinRequest,
                action: [EnumPolicyAction.update],
            },
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.create, EnumPolicyAction.delete],
            },
            {
                subject: EnumPolicySubject.analytic,
                action: [EnumPolicyAction.read],
            },
        ],
    },
    {
        scope: EnumRoleScope.workspace,
        key: EnumRoleWorkspaceKey.member,
        policies: [
            {
                subject: EnumPolicySubject.workspace,
                action: [EnumPolicyAction.read],
            },
        ],
    },
    {
        scope: EnumRoleScope.project,
        key: EnumRoleProjectKey.admin,
        policies: [
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.read, EnumPolicyAction.update],
            },
            {
                subject: EnumPolicySubject.projectMember,
                action: [
                    EnumPolicyAction.create,
                    EnumPolicyAction.update,
                    EnumPolicyAction.delete,
                ],
            },
        ],
    },
    {
        scope: EnumRoleScope.project,
        key: EnumRoleProjectKey.member,
        policies: [
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.read],
            },
        ],
    },
    {
        scope: EnumRoleScope.project,
        key: EnumRoleProjectKey.viewer,
        policies: [
            {
                subject: EnumPolicySubject.project,
                action: [EnumPolicyAction.read],
            },
        ],
    },
];

export const MigrationPolicyData: Record<
    EnumAppEnvironment,
    IMigrationPolicyData[]
> = {
    [EnumAppEnvironment.local]: PolicyData,
    [EnumAppEnvironment.test]: PolicyData,
    [EnumAppEnvironment.development]: PolicyData,
    [EnumAppEnvironment.staging]: PolicyData,
    [EnumAppEnvironment.production]: PolicyData,
};
