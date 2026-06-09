export interface IErrorMonitor {
  /**
   * Capture an error and send it to the monitoring service.
   * @param error The exception/error to capture.
   */
  captureException(error: unknown): void;

  /**
   * Set the currently logged-in user so errors are linked to them.
   * @param user The user object containing an ID and optional email.
   */
  setUser(user: { id: string; email?: string }): void;
}
