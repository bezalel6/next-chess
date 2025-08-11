import { test, expect, chromium, type Browser, type BrowserContext } from '@playwright/test';
import { GameHelpers, type Player } from './utils/game-helpers';
import { Linker } from '../../src/test-utils/linker';

/**
 * E2E test for two-player game setup and matchmaking
 * Tests the critical path: authentication → queue → matchmaking
 */
test.describe.serial('Two Player Game Setup', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let player1: Player;
  let player2: Player;

  test.beforeAll(async () => {
    browser = await chromium.launch();
    
    // Create contexts and players once for all tests
    context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    player1 = { page: page1, name: 'Player1', color: 'white' };
    player2 = { page: page2, name: 'Player2', color: 'black' };
    
    // Setup player 1 early to avoid rate limits
    await GameHelpers.continueAsGuest(player1.page, player1.name);
  });

  test.afterAll(async () => {
    await context1?.close();
    await context2?.close();
    await browser?.close();
  });

  test('setup second player and verify both ready', async () => {
    // Setup player 2 after delay (player 1 was set up in beforeAll)
    await GameHelpers.continueAsGuest(player2.page, player2.name);
    
    // Verify both players are on the queue page
    await expect(player1.page.locator(Linker.queue.findGameButton.selector)).toBeVisible({ timeout: 10000 });
    await expect(player2.page.locator(Linker.queue.findGameButton.selector)).toBeVisible({ timeout: 10000 });
  });

  test('both players can join matchmaking', async () => {
    // Both players join matchmaking
    await Promise.all([
      GameHelpers.joinMatchmaking(player1.page),
      GameHelpers.joinMatchmaking(player2.page)
    ]);

    // Verify both reached game page
    await Promise.all([
      player1.page.waitForURL(/\/game\/.+/, { timeout: 30000 }),
      player2.page.waitForURL(/\/game\/.+/, { timeout: 30000 })
    ]);
  });
});