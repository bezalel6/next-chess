# Board Layout Philosophy (CSS-first, Lichess-style)

This document explains the new approach we migrated to for sizing and laying out the chess board and its surrounding UI. The goals are:

- Treat the chessboard as a black box (Chessground internals are never modified)
- Make the board fill the available width and remain perfectly square
- Provide a simple, robust, CSS-first resize story that mirrors lichess.org
- Keep overlays that visually belong to the board rendered inside the board container
- Persist user sizing preferences across page loads
- Keep side panels and under-board UI consistent and predictable

## Core Principles

1) Board as a black box
- The Chessground view is mounted inside a dedicated container (`.boardContent`) that fills the board frame (absolute, inset 0).
- We do not insert or modify Chessground’s DOM structure. All visual effects that belong to the board are implemented on containers we control.

2) The center column is the resizable element
- The column that contains the Board + under-board UI is the element users resize.
- This column lives in each page’s layout (`GameLayout` for online games, `local-game` for local play).
- The board frame simply fills the column width and stays square using CSS `aspect-ratio: 1`.

3) Native-feeling resize with a simple handle
- A small se-resize icon is overlaid at the board’s bottom-right corner (inside the board frame), making it obvious where to grab.
- Dragging the handle resizes the center column width directly.
- Width is clamped to 400–1200 px and persisted to `localStorage` as `boardSize`.

4) CSS-first sizing and layering
- `.boardFrame` owns the square aspect and clips its internals (`overflow: hidden`).
- `.boardContent` holds the Chessground view. It never changes size independently; it inherits from the frame.
- The ban border overlay and the resize icon are rendered inside the board frame so they always move with the board and layer above the chess content.
- Z-index ordering ensures the resize icon is always visible above board overlays.

5) Under-board UI does not push the board
- UI that appears under the board (e.g., ban overlay banners, text input, etc.) is placed in a sibling container (the “fold”) positioned relative to the center column. This prevents it from pushing the board upward or causing clipping into the header.

6) Identical behavior across pages
- The same center-column pattern is used on `/game/[id]` and `/local-game`.
- On small screens (≤480px), resize is disabled for a sensible default experience.

## Implementation Notes

Files of interest:
- `src/styles/board.module.css`
  - `.boardFrame`: the square board wrapper (width: 100%, aspect-ratio: 1, overflow: hidden)
  - `.boardContent`: absolutely fills the frame; Chessground is mounted here
  - `.banBorderOverlay`: explicit DOM overlay for the red border during ban phase (inside the frame)
  - `.resizeHandle`: the visible se-resize icon at the board’s bottom-right (high z-index, white with black outline)
  - `.boardStack`, `.boardFold`: wrappers to control stacking and under-board placement without affecting board position

- `src/components/GameBoard.tsx`
  - Renders the board frame and contents, and now renders the ban border overlay + resize handle inside the frame
  - Accepts `onResizeHandleMouseDown` so page layouts can resize the center column when the user drags the handle
  - Uses a `ResizeObserver` only to call `api.redrawAll()` on board size changes (no layout mutations done here)

- `src/components/GameLayout.tsx` and `src/pages/local-game.tsx`
  - The center column is the resizable element (`resize: horizontal` + drag handle logic)
  - On mount, restores `boardSize` from `localStorage` and clamps to `[400, 1200]`
  - Uses a `ResizeObserver` to persist updates to `boardSize` (scheduled via `requestAnimationFrame` to avoid observer loop warnings)
  - Passes `onResizeHandleMouseDown` to `GameBoard` so the bottom-right handle resizes the column

## Data and Persistence
- The user’s preferred board size is persisted as `localStorage.boardSize` (in pixels).
- We also mirror the width into the CSS variable `--board-size` for potential future styling needs.

## Accessibility and Mobile
- The se-resize icon is visible and high-contrast; it’s small but clear.
- On small screens (≤480px), the handle is hidden and manual resize is disabled for layout stability.

## Performance
- Resizing does not create layout thrash in the board logic:
  - Chessground is redrawn (`api.redrawAll()`) in an animation frame after `ResizeObserver` events.
  - Persistence writes are simple and happen after sizing settles.

## Migration Summary
- Removed the overlay resizer component and any CSS-variable-driven container width.
- Unified both online and local game pages behind a single, simple pattern: center-column controls width; board fills it and stays square; overlays belong to the board container.
- Minimal JS, CSS-first control, clear layering, and a single source of truth for sizing.

