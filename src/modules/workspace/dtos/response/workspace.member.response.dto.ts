import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { StorageAssetExample } from '@common/storage/constants/storage.constant';
import { DatabaseResponseSchema } from '@common/database/dtos/response/database.response.dto';
import { EnumWorkspaceMemberRole } from '@generated/prisma-client/client';
import { UserRefResponseSchema } from '@modules/user/dtos/response/user.ref.response.dto';

/**
 * Base workspace-member shape: the row binding a user to the workspace they belong to.
 * @public
 */
export const WorkspaceMemberResponseSchema = DatabaseResponseSchema.omit({
    deletedAt: true,
    deletedBy: true,
}).extend({
    workspaceId: z.string().meta({
        description: 'Identifier of the workspace the member belongs to',
        example: faker.string.uuid(),
    }),
    userId: z.string().meta({
        description: 'Identifier of the member user',
        example: faker.string.uuid(),
    }),
    user: UserRefResponseSchema.meta({
        description: 'Embedded user of this workspace member',
        example: {
            id: faker.string.uuid(),
            createdAt: faker.date.recent(),
            createdBy: faker.string.uuid(),
            updatedAt: faker.date.recent(),
            updatedBy: faker.string.uuid(),
            deletedAt: faker.date.recent(),
            deletedBy: faker.string.uuid(),
            name: faker.person.fullName(),
            username: faker.internet.username().toLowerCase(),
            photo: StorageAssetExample,
        },
    }),
    role: z.enum(EnumWorkspaceMemberRole).meta({
        description: 'Workspace role of the member',
        example: EnumWorkspaceMemberRole.member,
    }),
    joinedAt: z.date().meta({
        description: 'When the user joined the workspace',
        example: faker.date.past(),
    }),
});

/**
 * Workspace member with the user it binds.
 * @public
 */
export type WorkspaceMemberResponseDto = z.infer<
    typeof WorkspaceMemberResponseSchema
>;
