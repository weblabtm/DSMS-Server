import * as Sentry from '@sentry/node';

export class GlitchTipService {
  /**
   * Initialize the error monitoring service using Sentry/GlitchTip.
   * Relies on the SENTRY_DSN environment variable.
   */
  public static init(): void {
    const dsn = process.env.SENTRY_DSN;
    
    if (!dsn) {
      console.warn('SENTRY_DSN is not provided. GlitchTip/Sentry will not be initialized.');
      return;
    }

    Sentry.init({
      dsn,
      // You can add more configurations here, e.g., environment, tracesSampleRate
      environment: process.env.NODE_ENV || 'development',
    });
    
    console.log('GlitchTip/Sentry error monitoring initialized.');
  }

  /**
   * Capture an exception and send it to GlitchTip.
   * @param error The error to capture
   */
  public static captureException(error: unknown): void {
    Sentry.captureException(error);
  }

  /**
   * Capture a plain message and send it to GlitchTip.
   * @param message The message to capture
   */
  public static captureMessage(message: string): void {
    Sentry.captureMessage(message);
  }
}
