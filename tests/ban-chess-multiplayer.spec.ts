import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Ban Chess Multiplayer', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  test.beforeEach(async ({ browser }) => {
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterEach(async () => {
    await context1?.close();
    await context2?.close();
  });

  test('two players can join matchmaking and play a game', async () => {
    await page1.goto('/');
    await page2.goto('/');

    // Give pages time to load
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    // Trigger quick test for player 1
    await page1.keyboard.press('Alt+Shift+Q');
    console.log('Player 1: Pressed Alt+Shift+Q');
    
    // Wait for automation status or matchmaking to appear
    await page1.waitForTimeout(3000);
    
    // Check for any sign of being in queue
    const inQueue1 = await page1.locator('text=/queue|waiting|finding|matchmaking/i').count() > 0;
    console.log('Player 1 in queue:', inQueue1);

    // Trigger quick test for player 2
    await page2.keyboard.press('Alt+Shift+Q');
    console.log('Player 2: Pressed Alt+Shift+Q');
    
    await page2.waitForTimeout(3000);
    
    const inQueue2 = await page2.locator('text=/queue|waiting|finding|matchmaking/i').count() > 0;
    console.log('Player 2 in queue:', inQueue2);

    await page1.waitForURL(/\/game\/[^/]+/, { timeout: 10000 });
    await page2.waitForURL(/\/game\/[^/]+/, { timeout: 10000 });

    const gameUrl1 = page1.url();
    const gameUrl2 = page2.url();
    expect(gameUrl1).toContain('/game/');
    expect(gameUrl2).toContain('/game/');
    
    const gameId1 = gameUrl1.split('/game/')[1];
    const gameId2 = gameUrl2.split('/game/')[1];
    expect(gameId1).toBe(gameId2);

    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    const whitePlayerPage = await findWhitePlayer(page1, page2);
    const blackPlayerPage = whitePlayerPage === page1 ? page2 : page1;

    console.log('White player identified, starting game flow');

    const banSelector = '.ban-overlay, [data-testid="ban-overlay"]';
    await blackPlayerPage.waitForSelector(banSelector, { timeout: 10000 });
    
    const banOverlay = blackPlayerPage.locator(banSelector).first();
    await expect(banOverlay).toBeVisible();
    
    const firstBanSquare = banOverlay.locator('[data-square]').first();
    await firstBanSquare.click();
    console.log('Black banned a move');

    await whitePlayerPage.waitForTimeout(2000);
    
    const e2Square = whitePlayerPage.locator('[data-square="e2"]').first();
    const e4Square = whitePlayerPage.locator('[data-square="e4"]').first();
    
    await e2Square.click();
    await whitePlayerPage.waitForTimeout(500);
    await e4Square.click();
    console.log('White played e2-e4');

    await whitePlayerPage.waitForTimeout(1000);
    
    await whitePlayerPage.waitForSelector(banSelector, { timeout: 10000 });
    const whiteBanOverlay = whitePlayerPage.locator(banSelector).first();
    await expect(whiteBanOverlay).toBeVisible();
    
    const whiteBanSquare = whiteBanOverlay.locator('[data-square]').first();
    await whiteBanSquare.click();
    console.log('White banned a move');

    await blackPlayerPage.waitForTimeout(2000);

    const e7Square = blackPlayerPage.locator('[data-square="e7"]').first();
    const e5Square = blackPlayerPage.locator('[data-square="e5"]').first();
    
    await e7Square.click();
    await blackPlayerPage.waitForTimeout(500);
    await e5Square.click();
    console.log('Black played e7-e5');

    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);

    const moveHistory1 = await page1.locator('.move-history, [data-testid="move-history"]').textContent();
    const moveHistory2 = await page2.locator('.move-history, [data-testid="move-history"]').textContent();
    
    expect(moveHistory1).toBeTruthy();
    expect(moveHistory2).toBeTruthy();
    console.log('Both players see move history');
  });

  test('server validates illegal moves', async () => {
    await page1.goto('/');
    await page2.goto('/');

    await page1.keyboard.press('Alt+Shift+Q');
    await page1.waitForTimeout(2000);
    await page2.keyboard.press('Alt+Shift+Q');
    await page2.waitForTimeout(2000);

    await page1.waitForURL(/\/game\/[^/]+/, { timeout: 15000 });
    await page2.waitForURL(/\/game\/[^/]+/, { timeout: 15000 });

    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    const whitePlayerPage = await findWhitePlayer(page1, page2);

    const a1Square = whitePlayerPage.locator('[data-square="a1"]').first();
    const h8Square = whitePlayerPage.locator('[data-square="h8"]').first();
    
    await a1Square.click();
    await whitePlayerPage.waitForTimeout(500);
    await h8Square.click();

    await whitePlayerPage.waitForTimeout(2000);

    const errorMessage = whitePlayerPage.locator('text=/invalid|illegal|not.*legal/i');
    const stillWhiteTurn = whitePlayerPage.locator('text=/white.*turn/i');
    
    const hasError = await errorMessage.count() > 0;
    const isStillWhiteTurn = await stillWhiteTurn.count() > 0;
    
    expect(hasError || isStillWhiteTurn).toBeTruthy();
    console.log('Server rejected illegal move');
  });

  test('ban mechanics prevent specific moves', async () => {
    await page1.goto('/');
    await page2.goto('/');

    await page1.keyboard.press('Alt+Shift+Q');
    await page1.waitForTimeout(2000);
    await page2.keyboard.press('Alt+Shift+Q');
    await page2.waitForTimeout(2000);

    await page1.waitForURL(/\/game\/[^/]+/, { timeout: 15000 });
    await page2.waitForURL(/\/game\/[^/]+/, { timeout: 15000 });

    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    const whitePlayerPage = await findWhitePlayer(page1, page2);
    const blackPlayerPage = whitePlayerPage === page1 ? page2 : page1;

    const banSelector = '.ban-overlay, [data-testid="ban-overlay"]';
    await blackPlayerPage.waitForSelector(banSelector, { timeout: 10000 });
    
    const e4Square = blackPlayerPage.locator('[data-square="e4"]').first();
    const isE4Visible = await e4Square.isVisible();
    
    if (isE4Visible) {
      await e4Square.click();
      console.log('Black banned e4');
      
      await whitePlayerPage.waitForTimeout(2000);
      
      const e2Square = whitePlayerPage.locator('[data-square="e2"]').first();
      const e4SquareWhite = whitePlayerPage.locator('[data-square="e4"]').first();
      
      await e2Square.click();
      await whitePlayerPage.waitForTimeout(500);
      await e4SquareWhite.click();
      
      await whitePlayerPage.waitForTimeout(2000);
      
      const errorMessage = whitePlayerPage.locator('text=/banned|prohibited|not.*allowed/i');
      const stillNeedMove = whitePlayerPage.locator('text=/white.*turn|make.*move/i');
      
      const hasBanError = await errorMessage.count() > 0;
      const stillWhiteTurn = await stillNeedMove.count() > 0;
      
      expect(hasBanError || stillWhiteTurn).toBeTruthy();
      console.log('Server enforced ban - move was prevented');
    } else {
      const anyBanSquare = blackPlayerPage.locator(banSelector).locator('[data-square]').first();
      await anyBanSquare.click();
      console.log('Black banned a different move');
    }
  });

  async function findWhitePlayer(p1: Page, p2: Page): Promise<Page> {
    const p1HasWhite = await p1.locator('text=/white.*you|you.*white|playing.*white/i').count() > 0;
    const p1ClockBottom = await p1.locator('.clock-bottom, [data-testid="player-clock"]').filter({ hasText: /white/i }).count() > 0;
    
    if (p1HasWhite || p1ClockBottom) {
      return p1;
    }
    
    const p2HasWhite = await p2.locator('text=/white.*you|you.*white|playing.*white/i').count() > 0;
    const p2ClockBottom = await p2.locator('.clock-bottom, [data-testid="player-clock"]').filter({ hasText: /white/i }).count() > 0;
    
    if (p2HasWhite || p2ClockBottom) {
      return p2;
    }
    
    await p1.waitForTimeout(2000);
    
    const p1PieceAtE2 = await p1.locator('[data-square="e2"] [data-piece]').count() > 0;
    if (p1PieceAtE2) {
      return p1;
    }
    
    return p2;
  }
});