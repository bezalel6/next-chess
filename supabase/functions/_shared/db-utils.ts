/// <reference lib="deno.ns" />
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleDbError } from "./response-utils.ts";
import { createLogger } from "./logger.ts";
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database-types.ts";

const logger = createLogger("DB");

type TableNames = keyof Database["public"]["Tables"];
type OrderOptions = { column: string; ascending?: boolean };

// More specific type for match conditions
type MatchFilter<T extends Record<string, any>> =
  | {
      [K in keyof T]?: T[K];
    }
  | {
      _in?: Record<string, any[]>[];
      _or?: Record<string, any>[];
    };

interface QueryOptions<T extends Record<string, any>> {
  select?: string;
  match?: MatchFilter<T>;
  data?: Partial<T>;
  limit?: number;
  order?: OrderOptions;
  single?: boolean;
  operation?: string; // For error logging
}

/**
 * Simplified database query with error handling
 */
export async function dbQuery<
  TableName extends TableNames,
  ResultType = Tables<TableName>,
>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: "select",
  options: Omit<QueryOptions<Tables<TableName>>, "data">,
): Promise<{ data?: ResultType | ResultType[]; error?: Error }>;

export async function dbQuery<
  TableName extends TableNames,
  ResultType = Tables<TableName>,
>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: "insert",
  options: QueryOptions<TablesInsert<TableName>> & {
    data: TablesInsert<TableName> | TablesInsert<TableName>[];
  },
): Promise<{ data?: ResultType | ResultType[]; error?: Error }>;

export async function dbQuery<
  TableName extends TableNames,
  ResultType = Tables<TableName>,
>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: "update" | "upsert",
  options: QueryOptions<TablesUpdate<TableName>> & {
    data: TablesUpdate<TableName> | TablesUpdate<TableName>[];
  },
): Promise<{ data?: ResultType | ResultType[]; error?: Error }>;

export async function dbQuery<
  TableName extends TableNames,
  ResultType = Tables<TableName>,
>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: "delete",
  options: Omit<QueryOptions<Tables<TableName>>, "data">,
): Promise<{ data?: ResultType | ResultType[]; error?: Error }>;

export async function dbQuery<
  TableName extends TableNames,
  ResultType = Tables<TableName>,
>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  operation: "select" | "insert" | "update" | "delete" | "upsert",
  options: QueryOptions<any> = {},
): Promise<{ data?: ResultType | ResultType[]; error?: Error }> {
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
        // Type assertion needed to satisfy TypeScript
        query = supabase.from(tableName).insert(data as any);
        if (select) query = query.select(select);
        break;
      case "update":
        // Type assertion needed to satisfy TypeScript
        query = supabase.from(tableName).update(data as any);
        if (select) query = query.select(select);
        break;
      case "delete":
        query = supabase.from(tableName).delete();
        if (select) query = query.select(select);
        break;
      case "upsert":
        // Type assertion needed to satisfy TypeScript
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

    return result as { data?: ResultType | ResultType[]; error?: Error };
  } catch (error) {
    logger.error(`${operationName} failed with exception:`, error);
    return { error: error as Error };
  }
}

/**
 * Get a specific record by ID with error handling
 */
export async function getRecordById<TableName extends TableNames>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  id: string,
  select?: string,
): Promise<{ data?: Tables<TableName>; error?: Error }> {
  logger.debug(`Getting ${tableName} record by ID: ${id}`);
  const result = await dbQuery<TableName, Tables<TableName>>(
    supabase,
    tableName,
    "select",
    {
      select,
      match: { id } as MatchFilter<Tables<TableName>>,
      single: true,
      operation: `get ${tableName} by ID`,
    },
  );

  // Convert array result to single item if needed
  return {
    data: Array.isArray(result.data) ? result.data[0] : result.data,
    error: result.error,
  };
}

/**
 * Check if a record exists without returning its contents
 */
export async function recordExists<TableName extends TableNames>(
  supabase: SupabaseClient<Database>,
  tableName: TableName,
  match: MatchFilter<Tables<TableName>>,
): Promise<boolean> {
  logger.debug(`Checking existence in ${tableName} with criteria:`, match);

  const { data, error } = await dbQuery<TableName>(
    supabase,
    tableName,
    "select",
    {
      select: "id",
      match,
      limit: 1,
      operation: `check ${tableName} exists`,
    },
  );

  if (error) {
    logger.error(`Error checking ${tableName} existence:`, error);
    return false;
  }

  return data && Array.isArray(data) && data.length > 0;
}
