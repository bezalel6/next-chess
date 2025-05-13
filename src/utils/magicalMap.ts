// Define the interface for our magical map
type MagicalMap<T> = {
  [key: string]: T;
} & { toArr(): T[] };

/**
 * Creates a magical map that initializes values on first access
 * @param initializer Function to create default values for new keys
 */
export function createMagicalMap<T>(initializer: () => T): MagicalMap<T> {
  const store: Record<string, T> = {};

  const magicalMap = {
    toArr(): T[] {
      return Object.values(store);
    },
  } as MagicalMap<T>;

  return new Proxy(magicalMap, {
    get(target, prop: string) {
      if (prop === "toArr") {
        return target.toArr;
      }

      // If property doesn't exist yet, initialize it
      if (!(prop in store)) {
        store[prop] = initializer();
      }
      return store[prop];
    },
  });
}

// Example usage
// const magicalArrayMap = createMagicalMap<number[]>(() => []);
// magicalArrayMap.users.push(2);
// // These keys don't exist yet, but they'll be automatically initialized
// magicalArrayMap["users"].push(1);
// magicalArrayMap["items"].push(42);

// console.log(magicalArrayMap["users"]); // [1]
// console.log(magicalArrayMap["items"]); // [42]
// console.log(magicalArrayMap["unknown"]); // [] (new empty array created on access)
// console.log(magicalArrayMap.toArr()); // [[2, 1], [42], []]
