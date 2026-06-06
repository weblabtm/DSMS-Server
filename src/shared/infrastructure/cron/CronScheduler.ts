import { type CronJob } from './CronJob.js';

export class CronScheduler {
    private readonly jobs = new Map<string, { job: CronJob; timer: NodeJS.Timeout }>();

    public register(job: CronJob): void {
        if (this.jobs.has(job.name)) {
            throw new Error(`Cron job with name "${job.name}" is already registered.`);
        }

        console.log(`[CronScheduler] Registering job: ${job.name} (interval: ${job.intervalMs}ms)`);
        
        // Run immediately on registration, then schedule at interval
        this.runJobSafe(job);
        
        const timer = setInterval(() => {
            this.runJobSafe(job);
        }, job.intervalMs);

        this.jobs.set(job.name, { job, timer });
    }

    public stopAll(): void {
        for (const [name, { timer }] of this.jobs.entries()) {
            console.log(`[CronScheduler] Stopping job: ${name}`);
            clearInterval(timer);
        }
        this.jobs.clear();
    }

    private async runJobSafe(job: CronJob): Promise<void> {
        try {
            await job.execute();
        } catch (error) {
            console.error(`[CronScheduler] Job "${job.name}" encountered an error during execution:`, error);
        }
    }
}
