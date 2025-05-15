/// <reference lib="deno.ns" />

// Define log levels for controlled logging
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Default to INFO in production, DEBUG in development
const DEFAULT_LOG_LEVEL =
  Deno.env.get("ENVIRONMENT") === "production" ? LogLevel.INFO : LogLevel.DEBUG;

// Get log level from environment or use default
const CURRENT_LOG_LEVEL =
  parseInt(Deno.env.get("LOG_LEVEL") || "") || DEFAULT_LOG_LEVEL;

/**
 * Centralized logging function to ensure consistent log formats
 */
export function log(
  level: LogLevel,
  module: string,
  message: string,
  data?: any,
): void {
  // Skip logging if below current level
  if (level < CURRENT_LOG_LEVEL) {
    return;
  }

  const timestamp = new Date().toISOString();
  const levelName = LogLevel[level];
  const logPrefix = `[${timestamp}] [${levelName}] [${module}]`;

  // Format the output based on whether data is provided
  if (data !== undefined) {
    console.log(`${logPrefix} ${message}`, data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }
}

/**
 * Logger factory that creates a named logger for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, data?: any) =>
      log(LogLevel.DEBUG, module, message, data),
    info: (message: string, data?: any) =>
      log(LogLevel.INFO, module, message, data),
    warn: (message: string, data?: any) =>
      log(LogLevel.WARN, module, message, data),
    error: (message: string, data?: any) =>
      log(LogLevel.ERROR, module, message, data),
  };
}
