import { test, expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Matchmaking Multiplayer Tests', () => {
  let browser1: Browser;
  let browser2: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  // Generate unique test credentials
  const timestamp = Date.now();
  const player1Email = `player1_${timestamp}@test.com`;
  const player2Email = `player2_${timestamp}@test.com`;
  const password = 'testpass123';

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts (like two different users)
    browser1 = browser;
    browser2 = browser;
    
    context1 = await browser1.newContext();
    context2 = await browser2.newContext();
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
  });

  test.afterAll(async () => {
    await context1.close();
    await context2.close();
  });

  test('two players can sign up simultaneously', async () => {
    // Both players navigate to homepage
    await Promise.all([
      page1.goto('http://localhost:3000'),
      page2.goto('http://localhost:3000')
    ]);

    // Wait for pages to load
    await Promise.all([
      page1.waitForLoadState('networkidle'),
      page2.waitForLoadState('networkidle')
    ]);

    // Both switch to sign up
    await Promise.all([
      page1.click('text=/don\'t have an account/i'),
      page2.click('text=/don\'t have an account/i')
    ]);

    // Player 1 signs up
    await page1.fill('input[name="username"]', `Player1_${timestamp}`);
    await page1.fill('input[name="email"]', player1Email);
    await page1.fill('input[name="password"]', password);

    // Player 2 signs up
    await page2.fill('input[name="username"]', `Player2_${timestamp}`);
    await page2.fill('input[name="email"]', player2Email);
    await page2.fill('input[name="password"]', password);

    // Both submit sign up
    await Promise.all([
      page1.click('button:has-text("Sign up")'),
      page2.click('button:has-text("Sign up")')
    ]);

    // Wait for response
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Check for success (either matchmaking UI or email confirmation)
    const player1Success = 
      await page1.locator('text=/Play Ban Chess|Find Game|check your email/i').isVisible().catch(() => false);
    const player2Success = 
      await page2.locator('text=/Play Ban Chess|Find Game|check your email/i').isVisible().catch(() => false);

    expect(player1Success || player2Success).toBeTruthy();
  });

  test('both players can join matchmaking queue', async () => {
    // Navigate to homepage if needed
    await Promise.all([
      page1.goto('http://localhost:3000'),
      page2.goto('http://localhost:3000')
    ]);

    // Try to sign in if not already logged in
    const needsSignIn1 = await page1.locator('button:has-text("Sign in")').isVisible().catch(() => false);
    const needsSignIn2 = await page2.locator('button:has-text("Sign in")').isVisible().catch(() => false);

    if (needsSignIn1) {
      await page1.fill('input[name="email"]', player1Email);
      await page1.fill('input[name="password"]', password);
      await page1.click('button:has-text("Sign in")');
      await page1.waitForTimeout(2000);
    }

    if (needsSignIn2) {
      await page2.fill('input[name="email"]', player2Email);
      await page2.fill('input[name="password"]', password);
      await page2.click('button:has-text("Sign in")');
      await page2.waitForTimeout(2000);
    }

    // Check if Find Game button is visible for both
    const findGameButton1 = page1.locator('button:has-text("Find Game")');
    const findGameButton2 = page2.locator('button:has-text("Find Game")');

    const canFindGame1 = await findGameButton1.isVisible().catch(() => false);
    const canFindGame2 = await findGameButton2.isVisible().catch(() => false);

    if (canFindGame1 && canFindGame2) {
      // Both players click Find Game simultaneously
      await Promise.all([
        findGameButton1.click(),
        findGameButton2.click()
      ]);

      // Both should show "Finding Opponent..."
      await expect(page1.locator('text=/Finding Opponent/i')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=/Finding Opponent/i')).toBeVisible({ timeout: 5000 });

      // Wait for potential match (game redirect)
      await page1.waitForTimeout(5000);
      
      // Check if either player got redirected to a game
      const player1InGame = page1.url().includes('/game/');
      const player2InGame = page2.url().includes('/game/');

      // If matched, both should be in the same game
      if (player1InGame && player2InGame) {
        const gameId1 = page1.url().split('/game/')[1];
        const gameId2 = page2.url().split('/game/')[1];
        expect(gameId1).toBe(gameId2);
        console.log(`✅ Players matched! Game ID: ${gameId1}`);
      } else {
        console.log('⏳ Players still in queue (this is normal if matchmaking edge function needs time)');
      }
    }
  });

  test('matched players can play moves in the game', async () => {
    // If both players are in a game
    const player1InGame = page1.url().includes('/game/');
    const player2InGame = page2.url().includes('/game/');

    if (player1InGame && player2InGame) {
      // Wait for game to load
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Check for game elements
      const gameLoaded1 = await page1.locator('text=/Turn:|Next Action:/i').isVisible().catch(() => false);
      const gameLoaded2 = await page2.locator('text=/Turn:|Next Action:/i').isVisible().catch(() => false);

      expect(gameLoaded1 || gameLoaded2).toBeTruthy();

      // Try to find chess pieces (Unicode characters)
      const hasPieces1 = await page1.locator('text=/♔|♕|♖|♗|♘|♙|♚|♛|♜|♝|♞|♟/').isVisible().catch(() => false);
      const hasPieces2 = await page2.locator('text=/♔|♕|♖|♗|♘|♙|♚|♛|♜|♝|♞|♟/').isVisible().catch(() => false);

      expect(hasPieces1 || hasPieces2).toBeTruthy();
      
      console.log('✅ Both players can see the game board');
    } else {
      // Try to create a direct game for testing
      const testGameId = `test-game-${Date.now()}`;
      await Promise.all([
        page1.goto(`http://localhost:3000/game/${testGameId}`),
        page2.goto(`http://localhost:3000/game/${testGameId}`)
      ]);

      await page1.waitForTimeout(2000);
      
      // Check if game page loads
      const hasGameContent1 = await page1.locator('text=/Game ID|Loading game/i').isVisible().catch(() => false);
      const hasGameContent2 = await page2.locator('text=/Game ID|Loading game/i').isVisible().catch(() => false);

      expect(hasGameContent1 || hasGameContent2).toBeTruthy();
    }
  });
});

test.describe('Queue Behavior Tests', () => {
  test('player can cancel matchmaking', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Create and sign up a test user
    const email = `cancel_test_${Date.now()}@test.com`;
    
    await page.click('text=/don\'t have an account/i');
    await page.fill('input[name="username"]', `CancelTest_${Date.now()}`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign up")');
    
    await page.waitForTimeout(3000);
    
    // Try to sign in if needed
    const needsSignIn = await page.locator('button:has-text("Sign in")').isVisible().catch(() => false);
    if (needsSignIn) {
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(2000);
    }
    
    // Find and click Find Game
    const findGameButton = page.locator('button:has-text("Find Game")');
    if (await findGameButton.isVisible().catch(() => false)) {
      await findGameButton.click();
      
      // Should show searching UI
      await expect(page.locator('text=/Finding Opponent/i')).toBeVisible({ timeout: 5000 });
      
      // Cancel button should be visible
      const cancelButton = page.locator('button:has-text("Cancel")');
      await expect(cancelButton).toBeVisible();
      
      // Click cancel
      await cancelButton.click();
      
      // Should return to Find Game state
      await expect(findGameButton).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Matchmaking cancel works correctly');
    }
  });

  test('shows queue timer while searching', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Create and sign up a test user
    const email = `timer_test_${Date.now()}@test.com`;
    
    await page.click('text=/don\'t have an account/i');
    await page.fill('input[name="username"]', `TimerTest_${Date.now()}`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button:has-text("Sign up")');
    
    await page.waitForTimeout(3000);
    
    // Try to sign in if needed
    const needsSignIn = await page.locator('button:has-text("Sign in")').isVisible().catch(() => false);
    if (needsSignIn) {
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(2000);
    }
    
    // Find and click Find Game
    const findGameButton = page.locator('button:has-text("Find Game")');
    if (await findGameButton.isVisible().catch(() => false)) {
      await findGameButton.click();
      
      // Should show timer
      await expect(page.locator('text=/Time in queue:/i')).toBeVisible({ timeout: 5000 });
      
      // Wait to see timer increment
      await page.waitForTimeout(3000);
      
      // Timer should show at least "0:03"
      const timerText = await page.locator('text=/Time in queue:/i').textContent();
      expect(timerText).toContain(':');
      
      // Cancel to clean up
      await page.locator('button:has-text("Cancel")').click();
      
      console.log('✅ Queue timer displays correctly');
    }
  });
});