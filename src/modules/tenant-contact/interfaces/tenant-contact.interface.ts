export interface ITenantContactCreate {
    tenantId: string;
    createdBy: string;
    firstName: string;
    lastName: string;
    category?: string;
    phone?: string;
    email?: string;
    notes?: string;
}

export interface ITenantContactUpdate {
    firstName?: string;
    lastName?: string;
    category?: string;
    phone?: string;
    email?: string;
    notes?: string;
}
