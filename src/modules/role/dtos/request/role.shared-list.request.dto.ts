import { z } from 'zod';
import { PaginationCursorQuerySchema } from '@common/pagination/dtos/pagination.cursor-query.dto';
import { EnumRoleScope } from '@generated/prisma-client/client';

/**
 * Role Shared List Request schema: a cursor page of the workspace or project role catalog.
 * @public
 */
export const RoleSharedListRequestSchema = PaginationCursorQuerySchema.extend({
    scope: z.enum([EnumRoleScope.workspace, EnumRoleScope.project]).meta({
        description: `Scope of the role catalog to list. Available scopes: ${EnumRoleScope.workspace}, ${EnumRoleScope.project}`,
        example: EnumRoleScope.workspace,
    }),
});

/**
 * Inferred DTO for RoleSharedListRequestSchema.
 * @public
 */
export type RoleSharedListRequestDto = z.infer<
    typeof RoleSharedListRequestSchema
>;
