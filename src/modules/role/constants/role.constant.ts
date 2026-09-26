/**
 * Prisma select for the role identity every assignment and log reads: id, scope, key and name.
 * @public
 */
export const RoleSelect = {
    id: true,
    scope: true,
    key: true,
    name: true,
} as const;

/**
 * Prisma select for the short role shape a client picks from: id, key and name.
 * @public
 */
export const RoleShortSelect = {
    id: true,
    key: true,
    name: true,
} as const;

/**
 * Prisma select for the shared role catalog rows: the short shape plus the `createdAt` the list orders by.
 * @public
 */
export const RoleSharedListSelect = {
    ...RoleShortSelect,
    createdAt: true,
} as const;
