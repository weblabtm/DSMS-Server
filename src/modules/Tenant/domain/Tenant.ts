export type TenantProps = {
    id: string;
    name: string;
    slug?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export class Tenant {
    public readonly id: string;
    public name: string;
    public slug?: string | null;
    public isActive: boolean;
    public createdAt: Date;
    public updatedAt: Date;

    public constructor(props: TenantProps) {
        this.id = props.id;
        this.name = props.name;
        this.slug = props.slug;
        this.isActive = props.isActive;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
}
