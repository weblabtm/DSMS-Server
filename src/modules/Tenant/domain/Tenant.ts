export type TenantProps = {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export class Tenant {
    public readonly id: string;
    public name: string;
    public isActive: boolean;
    public createdAt: Date;
    public updatedAt: Date;

    public constructor(props: TenantProps) {
        this.id = props.id;
        this.name = props.name;
        this.isActive = props.isActive;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
}
