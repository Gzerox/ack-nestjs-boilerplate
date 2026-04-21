export interface TenantContactSeedRecord {
    firstName: string;
    lastName: string;
    category?: string;
    phone?: string;
    email?: string;
    notes?: string;
}

const tenantContactData: TenantContactSeedRecord[] = [
    {
        firstName: 'Mario',
        lastName: 'Rossi',
        category: 'guest',
        email: 'guest@example.com',
        phone: '+39 333 1234567',
        notes: 'Sample guest contact for seeding.',
    },
    {
        firstName: 'Laura',
        lastName: 'Bianchi',
        category: 'vip',
        email: 'vip@example.com',
        phone: '+39 333 9876543',
    },
    {
        firstName: 'Giovanni',
        lastName: 'Verdi',
        category: 'staff',
        email: 'staff@example.com',
    },
];

export const migrationTenantContactData: TenantContactSeedRecord[] = tenantContactData;
