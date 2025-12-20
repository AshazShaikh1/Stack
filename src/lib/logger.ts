import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, any>;

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  error(message: string, error?: any, context?: LogContext) {
    // 1. Local Logging
    if (this.isDev) {
      console.error(`🔴 [ERROR] ${message}`, {
        error: error?.message || error,
        stack: error?.stack,
        ...context,
      });
    }

    // 2. Sentry Reporting (Production)
    if (!this.isDev) {
      Sentry.captureException(error || new Error(message), {
        extra: { message, ...context },
        tags: {
          location: context?.context || 'unknown'
        }
      });
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDev) {
      console.warn(`🟡 [WARN] ${message}`, context);
    } else {
      Sentry.captureMessage(message, "warning");
    }
  }

  info(message: string, context?: LogContext) {
    if (this.isDev) {
      console.log(`🔵 [INFO] ${message}`, context);
    }
    // Optional: LogRocket.info(message) or Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: 'log',
      message: message,
      level: 'info',
      data: context
    });
  }
}

export const logger = new Logger();