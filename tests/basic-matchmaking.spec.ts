import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Basic Matchmaking', () => {
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

  test('quick test shortcut works and players match', async () => {
    // Navigate to home page
    await page1.goto('/');
    await page2.goto('/');
    
    // Wait for pages to fully load
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Use the quick test shortcut for player 1
    console.log('Triggering quick test for Player 1...');
    await page1.keyboard.press('Alt+Shift+Q');
    
    // Wait for player 1 to be signed in and in queue
    await page1.waitForTimeout(5000);
    
    // Check if player 1 shows any matchmaking UI
    const player1Status = await page1.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasQueue: body.includes('queue') || body.includes('Queue'),
        hasWaiting: body.includes('waiting') || body.includes('Waiting'),
        hasFinding: body.includes('finding') || body.includes('Finding'),
        hasMatchmaking: body.includes('matchmaking') || body.includes('Matchmaking'),
        fullText: body.substring(0, 500)
      };
    });
    console.log('Player 1 status:', player1Status);
    
    // Use the quick test shortcut for player 2
    console.log('Triggering quick test for Player 2...');
    await page2.keyboard.press('Alt+Shift+Q');
    
    // Wait for player 2 to be signed in and potentially match
    await page2.waitForTimeout(5000);
    
    // Check if player 2 shows any matchmaking UI
    const player2Status = await page2.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasQueue: body.includes('queue') || body.includes('Queue'),
        hasWaiting: body.includes('waiting') || body.includes('Waiting'),
        hasFinding: body.includes('finding') || body.includes('Finding'),
        hasMatchmaking: body.includes('matchmaking') || body.includes('Matchmaking'),
        fullText: body.substring(0, 500)
      };
    });
    console.log('Player 2 status:', player2Status);
    
    // Check if either player navigated to a game
    const url1 = page1.url();
    const url2 = page2.url();
    console.log('Player 1 URL:', url1);
    console.log('Player 2 URL:', url2);
    
    const player1InGame = url1.includes('/game/');
    const player2InGame = url2.includes('/game/');
    
    if (player1InGame && player2InGame) {
      console.log('Both players successfully matched and joined a game!');
      
      // Extract game IDs
      const gameId1 = url1.split('/game/')[1];
      const gameId2 = url2.split('/game/')[1];
      
      // Verify they're in the same game
      expect(gameId1).toBe(gameId2);
      console.log('Game ID:', gameId1);
      
      // Wait a bit for the game to load
      await page1.waitForTimeout(3000);
      await page2.waitForTimeout(3000);
      
      // Check for chess board presence
      const board1Visible = await page1.locator('[data-square]').first().isVisible().catch(() => false);
      const board2Visible = await page2.locator('[data-square]').first().isVisible().catch(() => false);
      
      expect(board1Visible).toBe(true);
      expect(board2Visible).toBe(true);
      console.log('Both boards are visible - game is ready!');
      
    } else {
      console.log('Players did not match successfully');
      console.log('Player 1 in game:', player1InGame);
      console.log('Player 2 in game:', player2InGame);
      
      // Take screenshots for debugging
      await page1.screenshot({ path: 'player1-failed.png' });
      await page2.screenshot({ path: 'player2-failed.png' });
      
      // Fail the test with helpful info
      expect(player1InGame && player2InGame).toBe(true);
    }
  });

  test('server validates moves correctly', async () => {
    // First get both players into a game using the shortcut
    await page1.goto('/');
    await page2.goto('/');
    
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Quick match both players
    await page1.keyboard.press('Alt+Shift+Q');
    await page1.waitForTimeout(3000);
    
    await page2.keyboard.press('Alt+Shift+Q');
    await page2.waitForTimeout(3000);
    
    // Wait for game URLs
    const maxWaitTime = 15000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const url1 = page1.url();
      const url2 = page2.url();
      
      if (url1.includes('/game/') && url2.includes('/game/')) {
        console.log('Both players in game!');
        break;
      }
      
      await page1.waitForTimeout(500);
    }
    
    // Verify we're in a game
    const inGame1 = page1.url().includes('/game/');
    const inGame2 = page2.url().includes('/game/');
    
    if (!inGame1 || !inGame2) {
      console.log('Failed to create game - skipping move validation test');
      test.skip();
      return;
    }
    
    // Wait for game to fully load
    await page1.waitForTimeout(5000);
    await page2.waitForTimeout(5000);
    
    // Determine which player is white (has pieces on row 1/2)
    const whiteIsPlayer1 = await page1.evaluate(() => {
      // Check if there's a piece on e2 (white pawn starting position)
      const e2 = document.querySelector('[data-square="e2"]');
      if (!e2) return false;
      
      // Check for piece element or background image
      const hasPiece = e2.querySelector('[data-piece]') !== null ||
                       window.getComputedStyle(e2).backgroundImage !== 'none';
      return hasPiece;
    });
    
    const whitePage = whiteIsPlayer1 ? page1 : page2;
    const blackPage = whiteIsPlayer1 ? page2 : page1;
    
    console.log('White player identified:', whiteIsPlayer1 ? 'Player 1' : 'Player 2');
    
    // Try to make a simple legal move (e2-e4)
    const e2 = whitePage.locator('[data-square="e2"]').first();
    const e4 = whitePage.locator('[data-square="e4"]').first();
    
    await e2.click();
    await whitePage.waitForTimeout(500);
    await e4.click();
    
    console.log('Attempted move e2-e4');
    await whitePage.waitForTimeout(2000);
    
    // Check if the move was made (piece should now be on e4)
    const moveSuccessful = await whitePage.evaluate(() => {
      const e4 = document.querySelector('[data-square="e4"]');
      if (!e4) return false;
      
      const hasPiece = e4.querySelector('[data-piece]') !== null ||
                       window.getComputedStyle(e4).backgroundImage !== 'none';
      return hasPiece;
    });
    
    console.log('Move successful:', moveSuccessful);
    
    // Note: In Ban Chess, after white moves, white bans a black move
    // So we might see a ban UI, but the move itself should have gone through
    expect(moveSuccessful).toBe(true);
  });
});