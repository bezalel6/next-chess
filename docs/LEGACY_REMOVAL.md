# Legacy removal summary

This repository previously included legacy hooks and services for game state, presence, and clock synchronization that have now been deprecated in favor of a unified, server-authoritative model using `useUnifiedGameStore` and `useGameSync`.

Removed/replaced references:
- useGameQuery/useGameQueries: tests updated to disable or remove usage. Primary page uses useGameSync.
- useGamePresence/presenceService: no longer used; presence UI simplified.
- useClockSync/clockManager: no longer used on client; clocks display server-provided times.
- LocalGamePanel: replaced by shared GamePanel.

Follow-ups:
- Consider deleting src/hooks/useGameQueries.ts, src/hooks/useClockSync.ts, src/services/presenceService.ts if no longer needed by any route. Currently retained for reference, but unreferenced by code paths.
- Ensure docs reflect the authoritative snapshot approach and version gating.

