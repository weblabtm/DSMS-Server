import * as Sentry from '@sentry/node';
import type { IErrorMonitor } from './IErrorMonitor.js';

export class GlitchTipMonitor implements IErrorMonitor {
  constructor(dsn: string) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
    });
  }

  public captureException(error: unknown): void {
    Sentry.captureException(error);
  }

  public setUser(user: { id: string; email?: string }): void {
    Sentry.setUser(user);
  }
}
