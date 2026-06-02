export type CreateTenantRequestDto = {
    name: string;
    slug: string;
    tenantAdminIdentifier: string;
};

export type TenantResponseDto = {
    id: string;
    name: string;
    slug?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type TenantSlugAvailabilityResponseDto = {
    slug: string;
    available: boolean;
    reason?: 'invalid' | 'reserved' | 'taken';
};

export type UpdateTenantRequestDto = {
    name?: string;
    isActive?: boolean;
};
