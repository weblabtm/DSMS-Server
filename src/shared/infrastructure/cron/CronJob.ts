export abstract class CronJob {
    public abstract get name(): string;
    public abstract get intervalMs(): number;
    public abstract execute(): Promise<void>;
}
