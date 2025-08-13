import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Linker } from '../../../src/test-utils/linker';

export interface Player {
  page: Page;
  name: string;
  color: 'white' | 'black';
}

// Rate limit helper to avoid hitting Supabase limits
export class RateLimiter {
  private static lastAuthTime = 0;
  private static AUTH_DELAY_MS = 3000; // 3 seconds between auth attempts

  static async waitForAuth() {
    const now = Date.now();
    const timeSinceLastAuth = now - this.lastAuthTime;
    if (timeSinceLastAuth < this.AUTH_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.AUTH_DELAY_MS - timeSinceLastAuth));
    }
    this.lastAuthTime = Date.now();
  }
}

export class GameHelpers {
  /**
   * Continue as guest and set username
   */
  static async continueAsGuest(page: Page, playerName: string) {
    // Apply rate limiting to avoid hitting Supabase limits
    await RateLimiter.waitForAuth();
    
    await page.goto('/');
    
    // Wait for auth form to load
    await expect(page.locator(Linker.auth.signInAsGuest.selector)).toBeVisible({ timeout: 10000 });
    
    // Click "Continue as Guest"
    await page.locator(Linker.auth.signInAsGuest.selector).click();
    
    // Wait for redirect after auth
    await page.waitForTimeout(2000);
  }
  

  /**
   * Sign in with test credentials
   */
  static async signIn(page: Page, username: string, password: string) {
    await page.goto('/');
    
    // Wait for login form
    await expect(page.locator(Linker.auth.loginButton.selector)).toBeVisible({ timeout: 10000 });
    
    // Fill credentials
    await page.locator(Linker.auth.usernameInput.selector).fill(username);
    await page.locator(Linker.auth.passwordInput.selector).fill(password);
    
    // Click login
    await page.locator(Linker.auth.loginButton.selector).click();
    
    // Wait for redirect
    await page.waitForURL('/', { timeout: 10000 });
  }

  /**
   * Join matchmaking queue
   */
  static async joinMatchmaking(page: Page) {
    // Wait for queue system to load
    await expect(page.locator(Linker.queue.findGameButton.selector)).toBeVisible({ timeout: 10000 });
    
    // Click find game
    await page.locator(Linker.queue.findGameButton.selector).click();
    
    // Wait for game to start (URL changes to /game/*)
    await page.waitForURL(/\/game\/.+/, { timeout: 30000 });
  }

  /**
   * Wait for player's turn (either ban or move phase)
   */
  static async waitForTurn(player: Player) {
    const page = player.page;
    
    // Wait for either ban phase or move phase indicator
    await expect(
      page.locator(Linker.game.banPhaseIndicator.selector)
        .or(page.locator(Linker.game.yourTurnIndicator.selector))
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Select a move to ban during ban phase
   */
  static async selectBan(player: Player, moveNotation: string) {
    const page = player.page;
    
    // Wait for ban phase
    await expect(page.locator(Linker.game.banPhaseIndicator.selector)).toBeVisible({ timeout: 10000 });
    
    // Parse move notation (e.g., "e2e4" or "e2-e4")
    const [from, to] = GameHelpers.parseMove(moveNotation);
    
    // Click source square to see legal moves
    await page.locator(Linker.game.square(from).selector).click();
    
    // Click destination square to select ban
    await page.locator(Linker.game.square(to).selector).click();
    
    // Confirm ban if confirmation button exists
    const confirmButton = page.locator(Linker.game.confirmBanButton.selector);
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }
    
    // Wait for ban to be processed
    await page.waitForTimeout(500);
  }

  /**
   * Make a move during move phase
   */
  static async makeMove(player: Player, moveNotation: string) {
    const page = player.page;
    
    // Wait for move phase
    await expect(page.locator(Linker.game.yourTurnIndicator.selector)).toBeVisible({ timeout: 10000 });
    
    const [from, to] = GameHelpers.parseMove(moveNotation);
    
    // Click source square
    await page.locator(Linker.game.square(from).selector).click();
    
    // Click destination square
    await page.locator(Linker.game.square(to).selector).click();
    
    // Wait for move to be processed
    await page.waitForTimeout(500);
  }

  /**
   * Take a screenshot with specified dimensions
   */
  static async takeScreenshot(player: Player, filename: string) {
    await player.page.setViewportSize({ width: 1920, height: 1080 });
    await player.page.screenshot({ 
      path: filename,
      fullPage: false
    });
  }

  /**
   * Get current game phase
   */
  static async getGamePhase(page: Page): Promise<'ban' | 'move' | 'waiting' | 'ended'> {
    if (await page.locator(Linker.game.gameOverModal.selector).isVisible().catch(() => false)) {
      return 'ended';
    }
    if (await page.locator(Linker.game.banPhaseIndicator.selector).isVisible().catch(() => false)) {
      return 'ban';
    }
    if (await page.locator(Linker.game.yourTurnIndicator.selector).isVisible().catch(() => false)) {
      return 'move';
    }
    return 'waiting';
  }

  /**
   * Parse move notation
   */
  private static parseMove(notation: string): [string, string] {
    // Handle notation like "e2e4" or "e2-e4"
    const cleaned = notation.replace('-', '').toLowerCase();
    if (cleaned.length !== 4) {
      throw new Error(`Invalid move notation: ${notation}`);
    }
    return [cleaned.slice(0, 2), cleaned.slice(2, 4)];
  }

  /**
   * Wait for game to end
   */
  static async waitForGameEnd(page: Page, timeout = 60000) {
    await expect(page.locator(Linker.game.gameOverModal.selector)).toBeVisible({ timeout });
  }

  /**
   * Get game result from game over modal
   */
  static async getGameResult(page: Page): Promise<string> {
    const gameOverMessage = page.locator(Linker.game.gameOverMessage.selector);
    await expect(gameOverMessage).toBeVisible();
    return await gameOverMessage.textContent() || '';
  }
}

/**
 * Test game controller for managing two-player games
 */
export class TestGame {
  player1: Player;
  player2: Player;
  moveCount = 0;

  constructor(player1: Player, player2: Player) {
    this.player1 = player1;
    this.player2 = player2;
  }

  /**
   * Play a complete turn (ban + move)
   */
  async playTurn(
    movingPlayer: Player, 
    banningPlayer: Player, 
    move: string, 
    ban?: string
  ) {
    // Ban phase (if ban is specified)
    if (ban) {
      await GameHelpers.selectBan(banningPlayer, ban);
    }
    
    // Move phase
    await GameHelpers.makeMove(movingPlayer, move);
    
    this.moveCount++;
  }

  /**
   * Capture screenshots from both perspectives
   */
  async captureState(screenshotPrefix: string) {
    await Promise.all([
      GameHelpers.takeScreenshot(this.player1, `${screenshotPrefix}_player1.png`),
      GameHelpers.takeScreenshot(this.player2, `${screenshotPrefix}_player2.png`)
    ]);
  }

  /**
   * Wait for both players to be in game
   */
  async waitForGameStart() {
    await Promise.all([
      this.player1.page.waitForURL(/\/game\/.+/, { timeout: 30000 }),
      this.player2.page.waitForURL(/\/game\/.+/, { timeout: 30000 })
    ]);
  }

  /**
   * Get game URL from first player
   */
  async getGameUrl(): Promise<string> {
    return this.player1.page.url();
  }
}