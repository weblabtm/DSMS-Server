export type TenantRecord = {
    id: string;
    name: string;
    slug?: string | null;
    isActive: boolean;
    // Branding
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    faviconUrl?: string | null;
    // Plan
    planTier: string;
    planExpiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export interface TenantDao {
    create(record: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<TenantRecord>;
    findById(id: string): Promise<TenantRecord | undefined>;
    findBySlug(slug: string): Promise<TenantRecord | undefined>;
    list(): Promise<TenantRecord[]>;
    update(id: string, patch: Partial<Omit<TenantRecord, 'id' | 'createdAt'>>): Promise<TenantRecord>;
}
