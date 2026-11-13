import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { StorageAssetExample } from '@common/storage/constants/storage.constant';
import { DatabaseResponseSchema } from '@common/database/dtos/response/database.response.dto';
import { EnumProjectMemberRole } from '@generated/prisma-client/client';
import { UserRefResponseSchema } from '@modules/user/dtos/response/user.ref.response.dto';

/**
 * Base project-member shape: the row binding a user to the project they are assigned to.
 * @public
 */
export const ProjectMemberResponseSchema = DatabaseResponseSchema.omit({
    deletedAt: true,
    deletedBy: true,
}).extend({
    projectId: z.string().meta({
        description: 'Identifier of the project the member belongs to',
        example: faker.string.uuid(),
    }),
    userId: z.string().meta({
        description: 'Identifier of the member user',
        example: faker.string.uuid(),
    }),
    user: UserRefResponseSchema.meta({
        description: 'Embedded user of this project member',
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
    role: z.enum(EnumProjectMemberRole).meta({
        description: 'Project role of the member',
        example: EnumProjectMemberRole.member,
    }),
    joinedAt: z.date().meta({
        description: 'When the user joined the project',
        example: faker.date.past(),
    }),
});

/**
 * Project member with the user it binds.
 * @public
 */
export type ProjectMemberResponseDto = z.infer<
    typeof ProjectMemberResponseSchema
>;
