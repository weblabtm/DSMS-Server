export type TenantRecord = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export interface TenantDao {
    create(record: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<TenantRecord>;
    findById(id: string): Promise<TenantRecord | undefined>;
    list(): Promise<TenantRecord[]>;
    update(id: string, patch: Partial<Omit<TenantRecord, 'id' | 'createdAt'>>): Promise<TenantRecord>;
}
