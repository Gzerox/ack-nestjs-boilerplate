/**
 * Fixed tenant UUID used across all seed data.
 * There is no Tenant model — tenantId is a free UUID reference.
 */
export const SEED_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Email of the superadmin user created by the user seeder.
 * Used to resolve a real UUID for createdBy fields.
 */
export const SEED_USER_EMAIL = 'superadmin@mail.com';
