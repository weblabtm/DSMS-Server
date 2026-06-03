import { EmailNotificationService } from '../services/EmailNotificationService.js';

export class EmailRetryWorker {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    public constructor(
        private readonly emailService: EmailNotificationService,
        private readonly intervalMs = 60000 // every 60 seconds by default
    ) {}

    public start(): void {
        if (this.intervalId) return;

        console.log(`[EmailRetryWorker] Background Email retry worker started (tick: ${this.intervalMs}ms)`);
        this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[EmailRetryWorker] Background Email retry worker stopped');
        }
    }

    private async tick(): Promise<void> {
        if (this.isRunning) {
            console.log('[EmailRetryWorker] Previous retry tick is still running, skipping.');
            return;
        }

        this.isRunning = true;
        try {
            await this.emailService.processPendingRetries();
        } catch (error) {
            console.error('[EmailRetryWorker] Error in Email retry tick:', error);
        } finally {
            this.isRunning = false;
        }
    }
}
