import type { IErrorMonitor } from './IErrorMonitor.js';
import { GlitchTipMonitor } from './GlitchTipMonitor.js';
import { NullMonitor } from './NullMonitor.js';

export class MonitorFactory {
  public static create(): IErrorMonitor {
    if (process.env.NODE_ENV === 'test') {
      return new NullMonitor();
    }

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      console.warn('[MonitorFactory] SENTRY_DSN not set, using NullMonitor');
      return new NullMonitor();
    }

    return new GlitchTipMonitor(dsn);
  }
}
