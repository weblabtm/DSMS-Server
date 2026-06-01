import { Tenant } from '../domain/Tenant.js';
import type { TenantDao, TenantRecord as TenantRecordType } from '../application/dao/TenantDao.js';

export class InMemoryTenantDao implements TenantDao {
    private readonly store = new Map<string, TenantRecord>();

    public async create(record: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<TenantRecord> {
        const now = new Date();
        const saved: TenantRecord = {
            ...record,
            createdAt: now,
            updatedAt: now,
        };

        this.store.set(record.id, saved);

        return saved;
    }

    public async findById(id: string): Promise<TenantRecord | undefined> {
        return this.store.get(id);
    }

    public async findBySlug(slug: string): Promise<TenantRecord | undefined> {
        return Array.from(this.store.values()).find((tenant) => tenant.slug === slug);
    }

    public async list(): Promise<TenantRecord[]> {
        return Array.from(this.store.values());
    }

    public async update(id: string, patch: Partial<Omit<TenantRecord, 'id' | 'createdAt'>>): Promise<TenantRecord> {
        const existing = this.store.get(id);

        if (!existing) throw new Error('Tenant not found');

        const updated: TenantRecord = {
            ...existing,
            ...patch,
            updatedAt: new Date(),
        };

        this.store.set(id, updated);

        return updated;
    }
}

export type TenantRecord = TenantRecordType;
