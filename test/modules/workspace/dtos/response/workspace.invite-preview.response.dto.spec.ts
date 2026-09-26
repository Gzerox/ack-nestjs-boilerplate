import { WorkspaceInvitePreviewResponseSchema } from '@modules/workspace/dtos/response/workspace.invite-preview.response.dto';

describe('WorkspaceInvitePreviewResponseSchema', () => {
    const workspaceRole = {
        id: '01890a5d-ac96-774b-bcce-b302099a8057',
        key: 'member',
        name: 'Member',
    };

    it('selects safe preview fields and strips identifiers and tokens', () => {
        const result = WorkspaceInvitePreviewResponseSchema.parse({
            workspaceName: 'Workspace',
            inviterName: 'Inviter',
            workspaceRole,
            expiredAt: new Date(),
            id: 'invite-id',
            token: 'secret',
        });
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('token');
    });

    it('returns the workspace role as an id, key and name object', () => {
        const result = WorkspaceInvitePreviewResponseSchema.parse({
            workspaceName: 'Workspace',
            inviterName: 'Inviter',
            workspaceRole: { ...workspaceRole, description: 'extra' },
            expiredAt: new Date(),
        });
        expect(result.workspaceRole).toEqual(workspaceRole);
    });

    it('rejects a bare role key in place of the role object', () => {
        expect(
            WorkspaceInvitePreviewResponseSchema.safeParse({
                workspaceName: 'Workspace',
                inviterName: 'Inviter',
                workspaceRole: 'member',
                expiredAt: new Date(),
            }).success
        ).toBe(false);
    });
});
