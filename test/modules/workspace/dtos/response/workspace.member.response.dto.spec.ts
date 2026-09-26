import { WorkspaceMemberResponseSchema } from '@modules/workspace/dtos/response/workspace.member.response.dto';

describe('WorkspaceMemberResponseSchema', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const uuidV7 = '01890a5d-ac96-774b-bcce-b302099a8057';
    const member = {
        id: uuidV7,
        workspaceId: uuidV7,
        userId: uuidV7,
        roleId: uuidV7,
        joinedAt: now,
        createdAt: now,
        createdBy: null,
        updatedAt: now,
        updatedBy: null,
        user: {
            id: uuidV7,
            createdAt: now,
            createdBy: null,
            updatedAt: now,
            updatedBy: null,
            deletedAt: null,
            deletedBy: null,
            name: 'Member',
            username: 'member',
            photo: null,
        },
        role: { id: uuidV7, key: 'admin', name: 'Admin' },
    };

    it('exposes the role as an id, key and name object', () => {
        const result = WorkspaceMemberResponseSchema.parse(member);

        expect(result.role).toEqual({
            id: uuidV7,
            key: 'admin',
            name: 'Admin',
        });
    });

    it('strips any role field beyond id, key and name', () => {
        const result = WorkspaceMemberResponseSchema.parse({
            ...member,
            role: {
                ...member.role,
                scope: 'workspace',
                policies: [{ subject: 'workspace', action: ['manage'] }],
            },
        });

        expect(result.role).toEqual({
            id: uuidV7,
            key: 'admin',
            name: 'Admin',
        });
    });

    it('rejects a member carrying the legacy role enum string', () => {
        const result = WorkspaceMemberResponseSchema.safeParse({
            ...member,
            role: 'admin',
        });

        expect(result.success).toBe(false);
    });
});
