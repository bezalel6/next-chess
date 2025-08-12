import { test } from '@playwright/test';
import { GameOrchestrator } from './lib/game-orchestrator';

test.describe('Ban Chess Game Flow', () => {
  let orchestrator: GameOrchestrator;
  
  test.beforeEach(() => {
    orchestrator = new GameOrchestrator();
  });
  
  test.afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });
  
  test('should complete a two-player game with ban mechanics', async () => {
    test.setTimeout(120000); // 2 minute timeout
    
    try {
      await orchestrator.runGameFlow(10);
    } catch (error) {
      console.error('Test failed:', error);
      await orchestrator.captureScreenshots('error');
      throw error;
    }
  });
  
  test('should handle ban phase correctly', async () => {
    test.setTimeout(60000);
    
    await orchestrator.setupPlayers(2);
    await orchestrator.authenticateAllPlayers();
    await orchestrator.joinGameQueue();
    
    const gameStarted = await orchestrator.waitForGameStart();
    test.expect(gameStarted).toBe(true);
    
    // Play first few turns focusing on ban mechanics
    for (let i = 1; i <= 3; i++) {
      await orchestrator.playTurn(i);
      await orchestrator.captureScreenshots(`ban_test_turn${i}`);
    }
  });
});

// Standalone runner for direct execution
if (require.main === module) {
  (async () => {
    const orchestrator = new GameOrchestrator();
    try {
      await orchestrator.runGameFlow(10);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await orchestrator.cleanup();
    }
  })();
}