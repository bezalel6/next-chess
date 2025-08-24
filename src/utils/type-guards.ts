/**
 * Type guards and error handling utilities
 */

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

export function getErrorDetails(error: unknown): { message: string; stack?: string; code?: string } {
  if (isError(error)) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      message: err.message ? String(err.message) : 'Unknown error',
      stack: err.stack ? String(err.stack) : undefined,
      code: err.code ? String(err.code) : undefined,
    };
  }
  
  return {
    message: String(error),
  };
}

export function isSupabaseError(error: unknown): error is { message: string; code?: string; details?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}