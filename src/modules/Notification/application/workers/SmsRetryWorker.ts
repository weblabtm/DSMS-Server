import { SmsNotificationService } from '../services/SmsNotificationService.js';

export class SmsRetryWorker {
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    public constructor(
        private readonly smsService: SmsNotificationService,
        private readonly intervalMs = 60000 // every 60 seconds by default
    ) {}

    public start(): void {
        if (this.intervalId) return;

        console.log(`[SmsRetryWorker] Background SMS retry worker started (tick: ${this.intervalMs}ms)`);
        this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[SmsRetryWorker] Background SMS retry worker stopped');
        }
    }

    private async tick(): Promise<void> {
        if (this.isRunning) {
            console.log('[SmsRetryWorker] Previous retry tick is still running, skipping.');
            return;
        }

        this.isRunning = true;
        try {
            await this.smsService.processPendingRetries();
        } catch (error) {
            console.error('[SmsRetryWorker] Error in SMS retry tick:', error);
        } finally {
            this.isRunning = false;
        }
    }
}
