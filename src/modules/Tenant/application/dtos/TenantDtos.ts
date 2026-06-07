export type CreateTenantRequestDto = {
    name: string;
    slug: string;
    tenantAdminIdentifier: string;
};

export type TenantBrandingDto = {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    faviconUrl: string | null;
};

export type TenantResponseDto = {
    id: string;
    name: string;
    slug?: string | null;
    isActive: boolean;
    branding: TenantBrandingDto;
    planTier: string;
    planExpiresAt: string | null;
    featureFlags: string[];
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

export type UpdateTenantBrandingRequestDto = {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    faviconUrl?: string | null;
};

export type UpdateTenantPlanRequestDto = {
    planTier: string;
    planExpiresAt?: string | null;
};
