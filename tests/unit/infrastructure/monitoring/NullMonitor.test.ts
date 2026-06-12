import { describe, it, expect } from 'vitest';
// @ts-expect-error - NullMonitor does not exist yet (TDD Red Phase)
import { NullMonitor } from '../../../../src/infrastructure/monitoring/NullMonitor.js';

describe('NullMonitor', () => {
  it('does not throw when captureException is called', () => {
    const monitor = new NullMonitor();
    expect(() => monitor.captureException(new Error('test'))).not.toThrow();
  });

  it('does not throw when setUser is called', () => {
    const monitor = new NullMonitor();
    expect(() => monitor.setUser({ id: '123', email: 'test@example.com' })).not.toThrow();
  });
});
