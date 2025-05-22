import { useRef, useCallback, useMemo, useReducer } from "react";

// Define the interface for our magical map
type MagicalMap<T> = {
  [key: string]: T;
} & {
  toArray(): T[];
  clear(): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  keys(): string[];
  size(): number;
  triggerUpdate(): void;
};

/**
 * Creates a magical map that initializes values on first access
 * @param initializer Function to create default values for new keys
 */
function createMagicalMap<T>(initializer: () => T): MagicalMap<T> {
  const store: Record<string, T> = {};

  const magicalMap = {
    toArray(): T[] {
      return Object.values(store);
    },
    clear(): void {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
    has(key: string): boolean {
      return key in store;
    },
    delete(key: string): boolean {
      if (key in store) {
        delete store[key];
        return true;
      }
      return false;
    },
    keys(): string[] {
      return Object.keys(store);
    },
    size(): number {
      return Object.keys(store).length;
    },
    triggerUpdate(): void {
      // This will be overridden by the hook
    },
  } as MagicalMap<T>;

  return new Proxy(magicalMap, {
    get(target, prop: string) {
      // Return built-in methods
      if (prop in target) {
        return target[prop as keyof typeof target];
      }

      // If property doesn't exist yet, initialize it
      if (!(prop in store)) {
        store[prop] = initializer();
      }
      return store[prop];
    },
    set(target, prop: string, value: T) {
      // Don't allow overriding built-in methods
      if (prop in target) {
        return false;
      }
      store[prop] = value;
      return true;
    },
  });
}

/**
 * React hook for using a magical map with automatic re-rendering
 * @param initializer Function to create default values for new keys
 * @param dependencies Optional dependency array to recreate the map when changed
 */
export function useMagicalMap<T>(
  initializer: () => T,
  dependencies: React.DependencyList = [],
) {
  // Store the map in a ref to persist across renders
  const mapRef = useRef<MagicalMap<T> | null>(null);

  // Force re-render when the map changes
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Create the map only once or when dependencies change
  const magicalMap = useMemo(() => {
    mapRef.current = createMagicalMap(initializer);
    return mapRef.current;
  }, dependencies);

  // Method to trigger updates manually
  const triggerUpdate = useCallback(() => {
    forceUpdate();
  }, []);

  // Wrap methods that modify the map to trigger re-renders
  const clear = useCallback(() => {
    magicalMap.clear();
    forceUpdate();
  }, [magicalMap]);

  const deleteKey = useCallback(
    (key: string) => {
      const result = magicalMap.delete(key);
      if (result) {
        forceUpdate();
      }
      return result;
    },
    [magicalMap],
  );

  // Create a proxy that triggers re-renders on access/modification
  const reactiveMap = useMemo(() => {
    return new Proxy(magicalMap, {
      get(target, prop: string) {
        // If it's a method, return the wrapped version or original
        if (prop === "clear") return clear;
        if (prop === "delete") return deleteKey;
        if (prop === "triggerUpdate") return triggerUpdate;

        const value = target[prop as keyof typeof target];

        // For arrays, wrap mutating methods to trigger updates
        if (Array.isArray(value)) {
          return new Proxy(value, {
            get(arrayTarget: T[], arrayProp: string | symbol) {
              const arrayValue = arrayTarget[arrayProp as keyof T[]];

              // Wrap array mutating methods
              if (typeof arrayValue === "function") {
                const mutatingMethods = [
                  "push",
                  "pop",
                  "shift",
                  "unshift",
                  "splice",
                  "sort",
                  "reverse",
                  "fill",
                ];
                if (mutatingMethods.includes(arrayProp as string)) {
                  return function <U extends unknown[]>(...args: U) {
                    const result = (
                      arrayValue as (...args: U) => unknown
                    ).apply(arrayTarget, args);
                    forceUpdate();
                    return result;
                  };
                }
              }

              return arrayValue;
            },
            set(
              arrayTarget: T[],
              arrayProp: string | symbol,
              arrayValue: unknown,
            ) {
              const result = Reflect.set(arrayTarget, arrayProp, arrayValue);
              forceUpdate();
              return result;
            },
          });
        }

        return value;
      },
      set(target, prop: string, value: T) {
        const result = Reflect.set(target, prop, value);
        if (result && !(prop in target)) {
          forceUpdate();
        }
        return result;
      },
    });
  }, [magicalMap, clear, deleteKey, triggerUpdate]);

  return reactiveMap;
}

// Helper hook for common use case of arrays
export function useMagicalArrayMap<T = unknown>(
  dependencies: React.DependencyList = [],
) {
  return useMagicalMap<T[]>(() => [], dependencies);
}

// Helper hook for common use case of objects
export function useMagicalObjectMap<T extends Record<string, unknown>>(
  defaultObject: () => T,
  dependencies: React.DependencyList = [],
) {
  const map = useMagicalMap<T>(defaultObject, dependencies);

  // Return a proxy that also wraps object properties for reactivity
  return new Proxy(map, {
    get(target, prop: string) {
      const value = target[prop];

      // If it's an object (but not an array), wrap it to detect property changes
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(prop in target)
      ) {
        return new Proxy(value, {
          set(objTarget: T, objProp: string | symbol, objValue: unknown) {
            const result = Reflect.set(objTarget, objProp, objValue);
            (
              target as MagicalMap<T> & { triggerUpdate(): void }
            ).triggerUpdate();
            return result;
          },
        });
      }

      return value;
    },
  });
}

// Example React component usage:
/*
import React from 'react';
import { useMagicalArrayMap, useMagicalObjectMap } from './useMagicalMap';

function ExampleComponent() {
  const arrayMap = useMagicalArrayMap<string>();
  const userMap = useMagicalObjectMap(() => ({ name: '', age: 0 }));

  const addItem = (category: string, item: string) => {
    arrayMap[category].push(item);
  };

  const updateUser = (userId: string, updates: Partial<{ name: string; age: number }>) => {
    Object.assign(userMap[userId], updates);
  };

  return (
    <div>
      <button onClick={() => addItem('fruits', 'apple')}>
        Add Apple to Fruits
      </button>
      <button onClick={() => addItem('vegetables', 'carrot')}>
        Add Carrot to Vegetables
      </button>
      <button onClick={() => updateUser('user1', { name: 'John', age: 25 })}>
        Update User 1
      </button>
      
      <div>
        <h3>Arrays:</h3>
        {arrayMap.keys().map(key => (
          <div key={key}>
            {key}: {JSON.stringify(arrayMap[key])}
          </div>
        ))}
      </div>
      
      <div>
        <h3>Users:</h3>
        {userMap.keys().map(key => (
          <div key={key}>
            {key}: {JSON.stringify(userMap[key])}
          </div>
        ))}
      </div>
      
      <button onClick={() => arrayMap.clear()}>Clear Arrays</button>
      <button onClick={() => userMap.clear()}>Clear Users</button>
    </div>
  );
}
*/
