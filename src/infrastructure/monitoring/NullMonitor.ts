import type { IErrorMonitor } from './IErrorMonitor.js';

export class NullMonitor implements IErrorMonitor {
  public captureException(_error: unknown): void {
    // Intentionally does nothing (no side effects, no HTTP requests)
  }

  public setUser(_user: { id: string; email?: string }): void {
    // Intentionally does nothing
  }
}
