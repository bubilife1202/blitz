import * as Sentry from '@sentry/browser';

export interface ErrorReporterConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enabled?: boolean;
}

class ErrorReporter {
  private initialized = false;

  init(config: ErrorReporterConfig): void {
    if (this.initialized) return;
    
    const dsn = config.dsn || import.meta.env.VITE_SENTRY_DSN;
    
    if (!dsn || config.enabled === false) {
      console.log('[ErrorReporter] Disabled - no DSN provided');
      return;
    }

    Sentry.init({
      dsn,
      environment: config.environment || import.meta.env.MODE,
      release: config.release || `blitz@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (import.meta.env.DEV) {
          console.error('[Sentry]', event);
          return null;
        }
        return event;
      },
    });

    this.initialized = true;
    console.log('[ErrorReporter] Initialized');
  }

  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) {
      console.error('[ErrorReporter] Not initialized:', error);
      return;
    }

    Sentry.captureException(error, {
      extra: context,
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.initialized) {
      console.log(`[ErrorReporter] ${level}:`, message);
      return;
    }

    Sentry.captureMessage(message, level);
  }

  setUser(id: string, data?: Record<string, string>): void {
    if (!this.initialized) return;
    
    Sentry.setUser({ id, ...data });
  }

  addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    if (!this.initialized) return;
    
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

export const errorReporter = new ErrorReporter();
