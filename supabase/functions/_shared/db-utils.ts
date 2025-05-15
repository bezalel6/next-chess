/// <reference lib="deno.ns" />
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleDbError } from "./response-utils.ts";
import { createLogger } from "./logger.ts";

const logger = createLogger("DB");

type QueryFilter = Record<string, any>;
type OrderOptions = { column: string; ascending?: boolean };

interface QueryOptions<T> {
  select?: string;
  match?: QueryFilter;
  data?: Partial<T>;
  limit?: number;
  order?: OrderOptions;
  single?: boolean;
  operation?: string; // For error logging
}

/**
 * Simplified database query with error handling
 */
export async function dbQuery<T extends Record<string, any>>(
  supabase: SupabaseClient,
  tableName: string,
  operation: "select" | "insert" | "update" | "delete" | "upsert",
  options: QueryOptions<T> = {},
): Promise<{ data?: T | T[]; error?: Error }> {
  const {
    select,
    match,
    data,
    limit,
    order,
    single,
    operation: opName,
  } = options;
  const operationName = opName || `${operation} from ${tableName}`;

  logger.debug(`Executing ${operationName}`);

  try {
    let query;

    // Build the query based on the operation
    switch (operation) {
      case "select":
        query = supabase.from(tableName).select(select || "*");
        break;
      case "insert":
        query = supabase.from(tableName).insert(data as any);
        if (select) query = query.select(select);
        break;
      case "update":
        query = supabase.from(tableName).update(data as any);
        if (select) query = query.select(select);
        break;
      case "delete":
        query = supabase.from(tableName).delete();
        if (select) query = query.select(select);
        break;
      case "upsert":
        query = supabase.from(tableName).upsert(data as any);
        if (select) query = query.select(select);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    // Apply filters if provided
    if (match) {
      Object.entries(match).forEach(([key, value]) => {
        if (Array.isArray(value) && key === "_in") {
          // Handle IN queries
          const [inKey, inValues] = Object.entries(value[0])[0];
          query = query.in(inKey, inValues);
        } else if (key === "_or" && Array.isArray(value)) {
          // Handle OR queries with proper filter format
          // For Supabase, OR conditions need a properly formatted string
          // like 'column1.eq.value1,column2.eq.value2'
          const filterString = value
            .map((condition) => {
              const [condKey, condVal] = Object.entries(condition)[0];
              return `${condKey}.eq.${condVal}`;
            })
            .join(",");

          query = query.or(filterString);
        } else {
          // Standard equality
          query = query.eq(key, value);
        }
      });
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    // Apply ordering
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    // Get single result if requested
    if (single) {
      query = query.maybeSingle();
    }

    // Execute the query
    const result = await query;

    if (result.error) {
      logger.error(`${operationName} failed:`, result.error);
    } else {
      logger.debug(`${operationName} completed successfully`);
    }

    return result as { data?: T | T[]; error?: Error };
  } catch (error) {
    logger.error(`${operationName} failed with exception:`, error);
    return { error };
  }
}

/**
 * Get a specific record by ID with error handling
 */
export async function getRecordById<T extends Record<string, any>>(
  supabase: SupabaseClient,
  tableName: string,
  id: string,
  select?: string,
): Promise<{ data?: T; error?: Error }> {
  logger.debug(`Getting ${tableName} record by ID: ${id}`);
  return (await dbQuery<T>(supabase, tableName, "select", {
    select,
    match: { id },
    single: true,
    operation: `get ${tableName} by ID`,
  })) as Promise<{ data?: T; error?: Error }>;
}

/**
 * Check if a record exists without returning its contents
 */
export async function recordExists(
  supabase: SupabaseClient,
  tableName: string,
  match: QueryFilter,
): Promise<boolean> {
  logger.debug(`Checking existence in ${tableName} with criteria:`, match);

  const { data, error } = await dbQuery(supabase, tableName, "select", {
    select: "id",
    match,
    limit: 1,
    operation: `check ${tableName} exists`,
  });

  if (error) {
    logger.error(`Error checking ${tableName} existence:`, error);
    return false;
  }

  return data && Array.isArray(data) && data.length > 0;
}
