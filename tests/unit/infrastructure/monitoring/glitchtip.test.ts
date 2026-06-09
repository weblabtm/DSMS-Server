import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { GlitchTipService } from '../../../../src/infrastructure/monitoring/glitchtip.service';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('GlitchTipService (Error Monitoring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.SECURITY_ENDPOINT = 'https://example.com/security';
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.SECURITY_ENDPOINT;
  });

  it('should initialize Sentry with provided DSN', () => {
    GlitchTipService.init();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      })
    );
  });

  it('should not initialize Sentry if DSN is not provided', () => {
    delete process.env.SENTRY_DSN;
    GlitchTipService.init();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('should capture exception via captureException', () => {
    const error = new Error('Test error');
    GlitchTipService.captureException(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('should capture message via captureMessage', () => {
    const message = 'Test message';
    GlitchTipService.captureMessage(message);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(message);
  });
});
