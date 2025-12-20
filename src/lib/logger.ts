/**
 * Central Logger Service
 * Currently wraps console, but ready for Sentry/LogRocket injection.
 */

type LogContext = Record<string, any>;

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  error(message: string, error?: any, context?: LogContext) {
    // 1. Local Development Logging
    if (this.isDev) {
      console.error(`🔴 [ERROR] ${message}`, {
        error: error?.message || error,
        stack: error?.stack,
        ...context,
      });
    }

    // 2. Production Service (e.g., Sentry)
    // if (!this.isDev) {
    //   Sentry.captureException(error || new Error(message), {
    //     extra: { message, ...context }
    //   });
    // }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDev) {
      console.warn(`🟡 [WARN] ${message}`, context);
    }
    // Sentry.captureMessage(message, "warning");
  }

  info(message: string, context?: LogContext) {
    if (this.isDev) {
      console.log(`🔵 [INFO] ${message}`, context);
    }
    // Analytics.track(message, context);
  }
}

export const logger = new Logger();