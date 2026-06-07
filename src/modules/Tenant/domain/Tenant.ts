export type TenantBranding = {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    faviconUrl: string | null;
};

export type TenantProps = {
    id: string;
    name: string;
    slug?: string | null;
    isActive: boolean;
    branding: TenantBranding;
    planTier: string;
    planExpiresAt: Date | null;
    featureFlags: string[];
    createdAt: Date;
    updatedAt: Date;
};

export class Tenant {
    public readonly id: string;
    public name: string;
    public slug?: string | null;
    public isActive: boolean;
    public branding: TenantBranding;
    public planTier: string;
    public planExpiresAt: Date | null;
    public featureFlags: string[];
    public createdAt: Date;
    public updatedAt: Date;

    public constructor(props: TenantProps) {
        this.id = props.id;
        this.name = props.name;
        this.slug = props.slug;
        this.isActive = props.isActive;
        this.branding = props.branding;
        this.planTier = props.planTier;
        this.planExpiresAt = props.planExpiresAt;
        this.featureFlags = props.featureFlags;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
}
