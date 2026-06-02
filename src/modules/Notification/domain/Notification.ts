export abstract class Notification {
    public abstract readonly type: string;

    protected constructor(
        public readonly recipient: string,
        public readonly body: string,
        public readonly tenantId?: string,
        public readonly branchId?: string
    ) {}
}
