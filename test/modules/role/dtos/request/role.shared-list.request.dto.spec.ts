import { RoleSharedListRequestSchema } from '@modules/role/dtos/request/role.shared-list.request.dto';

describe('RoleSharedListRequestSchema', () => {
    it.each(['workspace', 'project'])('accepts scope=%s', scope => {
        expect(RoleSharedListRequestSchema.parse({ scope })).toEqual({
            scope,
        });
    });

    it.each([
        ['platform scope', { scope: 'platform' }],
        ['a missing scope', {}],
        ['a comma-delimited scope', { scope: 'workspace,project' }],
        ['an unknown scope', { scope: 'tenant' }],
        ['an unknown key', { scope: 'workspace', search: 'admin' }],
        ['an orderBy key', { scope: 'workspace', orderBy: 'createdAt:asc' }],
    ])('rejects %s', (_name, query) => {
        expect(RoleSharedListRequestSchema.safeParse(query).success).toBe(
            false
        );
    });

    it('keeps the cursor and perPage of the pagination kit', () => {
        expect(
            RoleSharedListRequestSchema.parse({
                scope: 'project',
                cursor: 'abc',
                perPage: '25',
            })
        ).toEqual({ scope: 'project', cursor: 'abc', perPage: 25 });
    });
});
