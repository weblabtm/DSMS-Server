import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
// @ts-expect-error - GlitchTipMonitor does not exist yet (TDD Red Phase)
import { GlitchTipMonitor } from '../../../../src/infrastructure/monitoring/GlitchTipMonitor.js';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
}));

describe('GlitchTipMonitor', () => {
  const TEST_DSN = 'https://test@app.glitchtip.com/1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Sentry with the provided DSN on construction', () => {
    new GlitchTipMonitor(TEST_DSN);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: TEST_DSN })
    );
  });

  it('calls Sentry.captureException with the error', () => {
    const monitor = new GlitchTipMonitor(TEST_DSN);
    const error = new Error('something broke');
    monitor.captureException(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('calls Sentry.setUser with the user object', () => {
    const monitor = new GlitchTipMonitor(TEST_DSN);
    monitor.setUser({ id: 'user_1', email: 'dev@example.com' });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user_1', email: 'dev@example.com' });
  });
});
