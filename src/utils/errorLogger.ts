interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  gameId?: string;
  [key: string]: any;
}

interface ErrorLog {
  message: string;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  userAgent: string;
  url: string;
  severity: 'error' | 'warning' | 'info';
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorQueue: ErrorLog[] = [];
  private isOnline: boolean = true;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushErrorQueue();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      // Catch unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.logError(new Error(event.reason), {
          component: 'UnhandledPromiseRejection',
          action: 'promise-rejection'
        });
      });
    }
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  logError(error: Error | unknown, context?: ErrorContext, severity: 'error' | 'warning' | 'info' = 'error'): void {
    const errorLog: ErrorLog = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      severity
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${severity.toUpperCase()}: ${errorLog.message}`);
      console.error('Error:', error);
      if (context) console.log('Context:', context);
      console.log('Stack:', errorLog.stack);
      console.groupEnd();
    }

    // Add to queue
    this.errorQueue.push(errorLog);

    // Try to send immediately if online
    if (this.isOnline) {
      this.flushErrorQueue();
    }

    // Store in localStorage as backup
    this.storeInLocalStorage(errorLog);
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // TODO: Send to error tracking service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ errors })
      // });
      
      // For now, just log that we would send
      if (process.env.NODE_ENV === 'development') {
        console.log('Would send errors to tracking service:', errors);
      }
    } catch (error) {
      // Put errors back in queue if sending failed
      this.errorQueue.unshift(...errors);
      console.error('Failed to send errors to tracking service:', error);
    }
  }

  private storeInLocalStorage(errorLog: ErrorLog): void {
    if (typeof window === 'undefined') return;
    
    try {
      const key = 'error_logs';
      const existing = localStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      // Keep only last 50 errors
      logs.push(errorLog);
      if (logs.length > 50) {
        logs.shift();
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (e) {
      // Silently fail if localStorage is full or unavailable
      console.warn('Failed to store error in localStorage:', e);
    }
  }

  getStoredErrors(): ErrorLog[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem('error_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  clearStoredErrors(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('error_logs');
    }
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();

// Utility functions for common error scenarios
export function logAPIError(error: unknown, endpoint: string, method: string = 'GET'): void {
  errorLogger.logError(error, {
    component: 'API',
    action: `${method} ${endpoint}`,
    endpoint,
    method
  });
}

export function logComponentError(error: unknown, componentName: string, action?: string): void {
  errorLogger.logError(error, {
    component: componentName,
    action: action || 'render'
  });
}

export function logGameError(error: unknown, gameId: string, action: string): void {
  errorLogger.logError(error, {
    component: 'Game',
    action,
    gameId
  });
}

// React hook for error handling
export function useErrorHandler() {
  return {
    logError: (error: unknown, context?: ErrorContext) => errorLogger.logError(error, context),
    logAPIError,
    logComponentError,
    logGameError
  };
}