export type CreateTenantRequestDto = {
    name: string;
    tenantAdminIdentifier: string;
};

export type TenantResponseDto = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type UpdateTenantRequestDto = {
    name?: string;
    isActive?: boolean;
};
