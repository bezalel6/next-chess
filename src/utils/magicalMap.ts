type MagicalMap<T> = {
  [key: string]: T;
};

/**
 * Creates a magical map that initializes values on first access
 * @param initializer Function to create default values for new keys
 */
export function createMagicalMap<T>(initializer: () => T): MagicalMap<T> {
  const store: Record<string, T> = {};

  return new Proxy(store, {
    get(target, prop: string) {
      // If property doesn't exist yet, initialize it
      if (!(prop in target)) {
        target[prop] = initializer();
      }
      return target[prop];
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
