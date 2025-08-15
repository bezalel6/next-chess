# Infinite Loop Fix Pattern Documentation

## Problem Description
Infinite render loops occur in React when using Zustand stores incorrectly. This happens when:
1. Functions are called inside selectors
2. New objects/arrays are created inside selectors
3. The entire store object is used as a dependency

## Root Cause
React compares dependencies by reference. When you create new objects or call functions inside selectors, React sees a new reference on every render, triggering another render, creating an infinite loop.

## The Fix Pattern

### ❌ DON'T: Call functions inside selectors
```typescript
// WRONG - Causes infinite loop
const legalMoves = useUnifiedGameStore(s => s.getLegalMoves());
```

### ✅ DO: Get function reference and call separately
```typescript
// CORRECT - Get function reference separately
const getLegalMoves = useUnifiedGameStore(s => s.getLegalMoves);
const legalMoves = useMemo(() => getLegalMoves(), [getLegalMoves, game?.currentFen]);
```

### ❌ DON'T: Create objects in selectors
```typescript
// WRONG - Creates new object every render
const storeState = useUnifiedGameStore((s) => ({
  mode: s.mode,
  phase: s.phase,
  game: s.game,
  myColor: s.myColor,
}));
```

### ✅ DO: Use individual atomic selectors
```typescript
// CORRECT - Individual selectors
const mode = useUnifiedGameStore((s) => s.mode);
const phase = useUnifiedGameStore((s) => s.phase);
const game = useUnifiedGameStore((s) => s.game);
const myColor = useUnifiedGameStore((s) => s.myColor);
```

### ❌ DON'T: Use entire store as dependency
```typescript
// WRONG - Store reference changes
const store = useUnifiedGameStore();
useEffect(() => {
  store.initLocalGame();
}, [store]); // Store reference changes every render!
```

### ✅ DO: Use specific store methods
```typescript
// CORRECT - Stable function references
const initLocalGame = useUnifiedGameStore(s => s.initLocalGame);
useEffect(() => {
  initLocalGame();
}, [initLocalGame]); // Function reference is stable
```

## Files Fixed (2025-08-15)

1. **src/components/LichessBoardV2.tsx**
   - Fixed `getLegalMoves()` being called inside selector
   - Now gets function reference and calls in useMemo

2. **src/stores/unifiedGameStore.ts**
   - Fixed `useCanMove` and `useCanBan` creating objects in selectors
   - Now uses individual atomic selectors

## Testing for Infinite Loops

Use the test page at `/test/infinite-loop` to verify fixes:
- Test 1: Basic store access (should be stable)
- Test 2: Store with function calls (fixed pattern)
- Test 3: useGameQuery hook (already uses correct pattern)
- Test 4: GameBoard pattern (demonstrates fixed approach)

## Prevention Guidelines

1. **Always use atomic selectors** for individual properties
2. **Never call functions** inside the selector arrow function
3. **Use useMemo** when you need to compute derived values
4. **Get function references separately** from the store
5. **Avoid creating objects/arrays** in selectors

## Related Commits
- `c1e413f` - Initial fix for infinite loop in useGameQueries hook
- `2eda19c` - Fixed infinite game subscription loop
- Current fix - Applied same pattern to LichessBoardV2 and store hooks