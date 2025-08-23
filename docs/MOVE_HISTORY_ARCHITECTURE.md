# Move History Architecture

## Overview
The move history system in Ban Chess handles the display and navigation of moves, including the unique ban mechanic where players ban opponent moves before each turn.

## Key Components

### 1. Data Sources
- **Local Games**: Move history comes directly from `unifiedGameStore.moveHistory`
  - Each move includes its associated ban information (`bannedMove` field)
  - Bans are preserved as part of the move record
  
- **Online Games**: Move history is parsed from PGN
  - Uses `parsePgnToMoveData()` function
  - Extracts ban information from PGN comments (format: `{[%clk banning: e2e4]}`)

### 2. Move Display Structure

#### Move Pairing
Moves are paired by move number for display:
```typescript
interface Move {
  number: number;
  white?: MoveData;
  black?: MoveData;
}
```

#### Pending Bans
When a ban is selected but the corresponding move hasn't been played yet:
- A "pending" move entry is created with `isPending: true`
- Displays as "—" in the move list
- Shows the ban icon with the banned squares
- Is fully clickable and navigable

### 3. Navigation System

#### Navigation States
```typescript
interface NavigationState {
  moveIndex: number;  // -1 for initial position, or ply number
  phase: "initial" | "after-ban" | "after-move";
}
```

#### Navigation Features
- **Dynamic Latest Position**: Automatically detects if a pending ban exists
- **Half-move Navigation**: Can navigate to position after ban but before move
- **Preserved Ban Data**: Each historical position maintains its correct ban information

### 4. Visual Feedback

#### Moves List
- Checkered pattern: Even rows have dark background, odd rows have light
- Move numbers integrated into white's cell
- Selected moves highlighted with golden outline
- Ban phase shows only the ban itself highlighted (red background)

#### Board Display
- Current banned move shown as red arrow
- Navigation shows historical bans correctly
- Pending bans immediately visible on board

## Implementation Details

### Local Game Move Storage
Each move in `moveHistory` includes:
```typescript
{
  from: Square;
  to: Square;
  san: string;
  fen: string;
  ply: number;
  bannedMove?: {
    from: Square;
    to: Square;
    byPlayer: PlayerColor;
    atMoveNumber: number;
  };
}
```

### Navigation Helpers
- `getLatestPosition()`: Dynamically determines the latest game position
- `canNavigateNext()`: Checks if forward navigation is possible
- `canNavigatePrevious()`: Checks if backward navigation is possible

### Board Synchronization
When navigating:
1. `navigateToPosition(ply, fen, ban)` is called
2. Store updates `viewingPly`, `navigationFen`, and `navigationBan`
3. Board component uses `navigationBan` when `viewingPly !== null`
4. Returns to live position when `viewingPly === null`

## Recent Fixes

### Banned Moves Corruption (2025-08-23)
**Problem**: Historical banned moves were showing the current banned move instead of the correct historical one.

**Root Cause**: Local games were parsing moves from PGN which didn't properly store ban information.

**Solution**: Local games now use `moveHistory` from the store directly, which preserves the `bannedMove` field for each move.

### Dynamic Navigation (2025-08-23)
**Problem**: Navigation logic was using excessive if/else chains.

**Solution**: Introduced helper functions (`getLatestPosition`, `canNavigateNext`) to centralize navigation logic.

### Pending Ban Display (2025-08-23)
**Problem**: Banned moves weren't showing immediately in the moves list.

**Solution**: Added support for "pending" moves that show bans before the corresponding move is played.

## Testing Considerations

When testing move history:
1. Verify bans are preserved when navigating backward/forward
2. Check that pending bans appear immediately
3. Ensure clicking on any move/ban navigates correctly
4. Validate that the board shows the correct historical ban
5. Test that returning to live position clears navigation state