import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { EnumRoleWorkspaceKey } from '@modules/role/enums/role.workspace-key.enum';

/**
 * Short role shape a client picks from: id, catalog key and name.
 * @public
 */
export const RoleShortSchema = z.object({
    id: z.uuid().meta({
        description: 'Id of role',
        example: faker.string.uuid(),
    }),
    key: z.string().meta({
        description: 'Immutable catalog key of the role',
        example: EnumRoleWorkspaceKey.owner,
    }),
    name: z.string().meta({
        description: 'Name of role',
        example: faker.person.jobTitle(),
    }),
});

/**
 * Short role shape.
 * @public
 */
export type RoleShortDto = z.infer<typeof RoleShortSchema>;
