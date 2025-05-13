/**
 * A generic map that handles partial updates with forgiving behavior for non-optional types
 */
export default class ForgivingMap<K, V, HasDefault extends boolean = false> {
  private map: Map<K, V> = new Map<K, V>();
  private defaultValue?: V;

  /**
   * Create a new ForgivingMap
   * @param defaultValue Optional default value for non-optional types
   */
  constructor(defaultValue?: HasDefault extends true ? V : never) {
    this.defaultValue = defaultValue as V | undefined;
  }

  /**
   * Get a value by key
   * @param key The key to retrieve
   * @returns The value or undefined if not found
   */
  get(key: K): V | undefined {
    return this.map.get(key);
  }

  /**
   * Set a key-value pair
   * @param key The key
   * @param value The value
   */
  set(key: K, value: V): this {
    this.map.set(key, value);
    return this;
  }

  /**
   * Check if a key exists in the map
   * @param key The key to check
   * @returns True if the key exists
   */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /**
   * Delete a key-value pair
   * @param key The key to delete
   * @returns True if deletion was successful
   */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /**
   * Clear all key-value pairs
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Update a value with partial data, merging with existing data
   * @param key The key to update
   * @param partialValue Partial data to merge
   * @returns This instance for chaining
   */
  update(key: K, partialValue: Partial<V>): this {
    if (this.has(key)) {
      const existingData = this.get(key) as V;
      this.map.set(key, { ...existingData, ...partialValue } as V);
    } else {
      // Use empty object or default value as base
      this.map.set(key, { ...(this.defaultValue || {}), ...partialValue } as V);
    }
    return this;
  }

  /**
   * Get all values as an array
   * @returns Array of values
   */
  values(): IterableIterator<V> {
    return this.map.values();
  }

  /**
   * Get all keys as an array
   * @returns Array of keys
   */
  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  /**
   * Get all entries as an array of [key, value] tuples
   * @returns Array of entries
   */
  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  /**
   * Get the number of key-value pairs
   * @returns The size of the map
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Convert the map to a plain object (works best with string keys)
   * @returns Plain object representation of the map
   */
  toObject(): Record<string, V> {
    const obj: Record<string, V> = {} as Record<string, V>;
    this.map.forEach((value, key) => {
      obj[String(key)] = value;
    });
    return obj;
  }

  /**
   * Create a ForgivingMap from an object
   * @param obj The source object
   * @param defaultValue Optional default value
   * @returns A new ForgivingMap
   */
  static fromObject<
    K extends string | number | symbol,
    V,
    HasDefault extends boolean = false,
  >(
    obj: Record<K, V>,
    defaultValue?: HasDefault extends true ? V : never,
  ): ForgivingMap<K, V, HasDefault> {
    const map = new ForgivingMap<K, V, HasDefault>(defaultValue);
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        map.set(key, obj[key]);
      }
    }
    return map;
  }

  /**
   * Loop through all entries
   * @param callbackFn Function to execute for each entry
   */
  forEach(callbackFn: (value: V, key: K, map: Map<K, V>) => void): void {
    this.map.forEach(callbackFn);
  }
}

/**
 * Helper type for creating a ForgivingMap with proper type requirements
 */
export type CreateForgivingMap<K, V> = {} extends V
  ? ForgivingMap<K, V, false>
  : ForgivingMap<K, V, true>;

/**
 * Helper function to create a ForgivingMap with proper type inference
 */
export function createForgivingMap<K, V>(
  defaultValue?: {} extends V ? never : V,
): CreateForgivingMap<K, V> {
  return new ForgivingMap<K, V, {} extends V ? false : true>(
    defaultValue as any,
  ) as CreateForgivingMap<K, V>;
}
