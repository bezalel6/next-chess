/// <reference lib="deno.ns" />
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import type { Database, Tables } from "./database-types.ts";

const logger = createLogger("DB");

/**
 * Helper to ensure a result is a single item (not an array)
 */
export function ensureSingle<T>(data: T | T[] | undefined): T | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Helper to ensure a result is always an array
 */
export function ensureArray<T>(data: T | T[] | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/**
 * Log a database operation
 */
export function logOperation(name: string, error?: any): void {
  if (error) {
    logger.error(`Operation '${name}' failed:`, error);
  } else {
    logger.debug(`Operation '${name}' completed successfully`);
  }
}

/**
 * Format OR conditions for Supabase
 */
export function formatOrConditions(conditions: Record<string, any>[]): string {
  return conditions
    .map((condition) => {
      const [key, value] = Object.entries(condition)[0];
      return `${key}.eq.${value}`;
    })
    .join(",");
}

/**
 * Type-safe Supabase client
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Type helper for getting typed table references
 *
 * Example usage:
 * ```
 * const gamesTable = getTable(supabase, 'games');
 * const { data } = await gamesTable.select('*').eq('status', 'active');
 * ```
 */
export function getTable<T extends keyof Database["public"]["Tables"]>(
  supabase: TypedSupabaseClient,
  table: T,
) {
  return supabase.from(table);
}
