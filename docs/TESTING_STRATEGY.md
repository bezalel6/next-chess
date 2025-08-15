# 2-Player Chess Game Testing Strategy

## Overview
Testing a real-time 2-player chess game requires simulating multiple authenticated users interacting simultaneously. This document outlines comprehensive testing approaches for both manual and automated testing.

## Key Testing Challenges
1. **Authentication Isolation**: Each player needs separate auth sessions
2. **Real-time Synchronization**: Testing immediate state updates across clients
3. **Ban Chess Logic**: Validating ban selection and move restrictions
4. **Concurrency**: Ensuring no race conditions in simultaneous actions

## Testing Approaches

### 1. Browser Context Isolation

#### A. Manual Testing with Multiple Browsers
```
Browser 1: Chrome (Player 1 - White)
Browser 2: Firefox/Edge (Player 2 - Black)
Browser 3: Incognito/Private (Spectator)
```

#### B. Automated Testing with Playwright
```typescript
// Create multiple browser contexts
const browser = await chromium.launch();
const context1 = await browser.newContext(); // Player 1
const context2 = await browser.newContext(); // Player 2
const page1 = await context1.newPage();
const page2 = await context2.newPage();
```

### 2. Test User Management

#### Test User Pool
Create dedicated test accounts:
```
test-white@chess.com / testpass123
test-black@chess.com / testpass123
test-spectator@chess.com / testpass123
test-player-3@chess.com / testpass123
test-player-4@chess.com / testpass123
```

#### Quick Authentication Helper
Use the `/test/new-game` endpoint:
- `?player=white` - Auto-creates white player account
- `?player=black` - Auto-creates black player account
- Automatically creates game and authenticates

### 3. Test Scenarios

#### Core Game Flow Tests
1. **Game Creation & Joining**
   - Player 1 creates game via queue
   - Player 2 joins via queue
   - Verify both see correct player assignments

2. **Ban Phase Testing**
   - Black player selects ban
   - Verify white player sees ban immediately
   - Verify banned move is restricted

3. **Move Execution**
   - White makes valid move
   - Verify black sees update instantly
   - Verify move history updates

4. **Turn Management**
   - Verify turn switches correctly
   - Verify only current player can move
   - Verify spectators cannot interact

#### Edge Cases & Error Handling
1. **Network Disruption**
   - Disconnect during move
   - Disconnect during ban selection
   - Reconnection and state recovery

2. **Timing Issues**
   - Simultaneous moves
   - Timeout handling
   - Clock synchronization

3. **Invalid Actions**
   - Attempt move when not your turn
   - Attempt banned move
   - Invalid move notation

### 4. Automated Test Implementation

#### Playwright Test Suite Structure
```typescript
// tests/multiplayer.spec.ts
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

class GameTestHelper {
  browser: Browser;
  whiteContext: BrowserContext;
  blackContext: BrowserContext;
  whitePage: Page;
  blackPage: Page;
  gameId: string;

  async setup() {
    // Initialize browsers and authenticate
  }

  async createGame() {
    // White player creates game
  }

  async joinGame() {
    // Black player joins
  }

  async selectBan(from: string, to: string) {
    // Black selects ban
  }

  async makeMove(player: 'white' | 'black', from: string, to: string) {
    // Execute move
  }

  async verifyGameState(expectedState: any) {
    // Check both players see same state
  }

  async cleanup() {
    // Close contexts
  }
}
```

#### Test Data Attributes
Add test IDs to components:
```tsx
<div data-testid="game-board">
<button data-testid="ban-move-e2e4">
<div data-testid="move-history">
<span data-testid="current-turn">
```

### 5. Manual Testing Checklist

#### Pre-Game
- [ ] Queue system shows correct status
- [ ] Matchmaking pairs players correctly
- [ ] Game creation assigns colors properly
- [ ] Both players redirected to game page

#### During Game
- [ ] Ban selection UI works correctly
- [ ] Banned move shows red arrow
- [ ] Moves execute and sync immediately
- [ ] Move history updates for both players
- [ ] Turn indicator is accurate
- [ ] Time controls work (if enabled)

#### Post-Game
- [ ] Game over detection works
- [ ] Winner/result displayed correctly
- [ ] Rematch offers work
- [ ] Return to lobby functions

### 6. Performance Testing

#### Metrics to Monitor
1. **Latency**: Move execution to opponent update
2. **Memory**: Check for leaks during long games
3. **CPU**: Monitor during complex positions
4. **Network**: Bandwidth usage for real-time updates

#### Load Testing
- Multiple concurrent games
- Rapid move sequences
- Many spectators per game

### 7. Development Testing Utilities

#### Debug Mode Features
```typescript
// Enable in development
window.__CHESS_DEBUG__ = {
  logMoves: true,
  showLatency: true,
  simulateDisconnect: () => {},
  forceError: (type: string) => {},
  getCurrentState: () => {},
};
```

#### Test Endpoints
- `/api/test/create-game` - Programmatic game creation
- `/api/test/reset-db` - Clear test data
- `/api/test/simulate-moves` - Replay game sequences

### 8. CI/CD Integration

#### GitHub Actions Workflow
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Start Supabase
        run: npx supabase start
      - name: Run E2E tests
        run: npm run test:e2e
```

### 9. Test Monitoring & Reporting

#### Metrics to Track
- Test pass rate
- Flaky test identification
- Performance regression
- Coverage reports

#### Error Logging
- Screenshot on failure
- Network request logs
- Console output capture
- State snapshots

### 10. Quick Test Commands

```bash
# Run all tests
npm run test

# Run E2E tests only
npm run test:e2e

# Run specific test file
npm run test:e2e -- multiplayer.spec.ts

# Run in headed mode (see browser)
npm run test:e2e -- --headed

# Run with specific browser
npm run test:e2e -- --browser=firefox

# Debug mode
npm run test:e2e -- --debug
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Stability**: Use explicit waits, not arbitrary delays
4. **Maintainability**: Use page objects and helpers
5. **Documentation**: Comment complex test logic
6. **Parallel Execution**: Design tests to run concurrently

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Auth token conflicts | Use separate browser contexts |
| State synchronization | Wait for WebSocket confirmation |
| Flaky tests | Add retry logic and better waits |
| Database pollution | Reset between test runs |
| Port conflicts | Use dynamic port allocation |

## Next Steps

1. Implement Playwright test suite
2. Add test IDs to all interactive elements
3. Create test data factories
4. Set up CI/CD pipeline
5. Add performance benchmarks
6. Implement visual regression testing