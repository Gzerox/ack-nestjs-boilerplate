import { z } from 'zod';
import { faker } from '@faker-js/faker';
import { DatabaseResponseSchema } from '@common/database/dtos/response/database.response.dto';
import { EnumPasswordHistoryType } from '@generated/prisma-client/client';
import { UserRefResponseSchema } from '@modules/user/dtos/response/user.ref.response.dto';

/**
 * Base password-history shape: one recorded password of a user, without the stored hash.
 * @public
 */
export const PasswordHistoryResponseSchema = DatabaseResponseSchema.omit({
    updatedAt: true,
    updatedBy: true,
    deletedAt: true,
    deletedBy: true,
}).extend({
    userId: z.string().meta({
        description: 'Identifier of the user whose password history this is',
        example: faker.string.uuid(),
    }),
    user: UserRefResponseSchema.omit({ photo: true }).meta({
        description: 'Embedded user whose password history this is',
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
        },
    }),
    type: z.enum(EnumPasswordHistoryType).meta({
        description: 'How this password history entry was created',
        example: EnumPasswordHistoryType.admin,
    }),
    expiredAt: z.date().meta({
        description: 'When this password history entry expires',
        example: faker.date.future(),
    }),
});

/**
 * Recorded password of a user without the stored hash.
 * @public
 */
export type PasswordHistoryResponseDto = z.infer<
    typeof PasswordHistoryResponseSchema
>;
