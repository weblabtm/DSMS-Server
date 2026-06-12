import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { MonitorFactory } from '../../../../src/infrastructure/monitoring/MonitorFactory.js';
import { NullMonitor } from '../../../../src/infrastructure/monitoring/NullMonitor.js';
import { GlitchTipMonitor } from '../../../../src/infrastructure/monitoring/GlitchTipMonitor.js';

vi.mock('../../../../src/infrastructure/monitoring/GlitchTipMonitor.js', () => {
  class MockGlitchTipMonitor {
    public captureException = vi.fn();
    public setUser = vi.fn();
  }
  return {
    GlitchTipMonitor: MockGlitchTipMonitor,
  };
});

describe('MonitorFactory', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns a NullMonitor when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    const monitor = MonitorFactory.create();
    expect(monitor).toBeInstanceOf(NullMonitor);
  });

  it('returns a NullMonitor when SENTRY_DSN is not set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SENTRY_DSN;
    const monitor = MonitorFactory.create();
    expect(monitor).toBeInstanceOf(NullMonitor);
  });

  it('returns a GlitchTipMonitor when NODE_ENV is production and DSN is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://abc@app.glitchtip.com/1';
    const monitor = MonitorFactory.create();
    expect(monitor).toBeInstanceOf(GlitchTipMonitor);
  });
});
