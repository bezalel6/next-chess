/**
 * Playwright E2E Tests for 2-Player Chess Game
 * With robust cleanup and process management
 */

import { test, expect, Browser, BrowserContext, Page, chromium, firefox } from '@playwright/test';
import { TEST_USERS, TestUserManager, TestGameManager, waitForGameUpdate } from '../src/utils/test-helpers';

// Global cleanup registry to ensure all resources are freed
const CLEANUP_REGISTRY = {
  browsers: new Set<Browser>(),
  contexts: new Set<BrowserContext>(),
  pages: new Set<Page>(),
  processIds: new Set<number>(),
};

// Process cleanup handler
process.on('SIGINT', async () => {
  console.log('SIGINT received, cleaning up test resources...');
  await globalCleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, cleaning up test resources...');
  await globalCleanup();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception, cleaning up:', error);
  await globalCleanup();
  process.exit(1);
});

// Global cleanup function
async function globalCleanup() {
  console.log('Starting global cleanup...');
  
  // Close all pages
  for (const page of CLEANUP_REGISTRY.pages) {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (e) {
      console.error('Error closing page:', e);
    }
  }
  
  // Close all contexts
  for (const context of CLEANUP_REGISTRY.contexts) {
    try {
      await context.close();
    } catch (e) {
      console.error('Error closing context:', e);
    }
  }
  
  // Close all browsers
  for (const browser of CLEANUP_REGISTRY.browsers) {
    try {
      await browser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
  }
  
  // Kill any remaining browser processes
  if (process.platform === 'win32') {
    const { exec } = await import('child_process');
    exec('taskkill /F /IM chrome.exe /T 2>nul');
    exec('taskkill /F /IM firefox.exe /T 2>nul');
    exec('taskkill /F /IM msedge.exe /T 2>nul');
  } else {
    const { exec } = await import('child_process');
    exec('pkill -f chromium || true');
    exec('pkill -f firefox || true');
  }
  
  console.log('Global cleanup completed');
}

/**
 * Enhanced test helper class with cleanup tracking
 */
class ChessGameTestHelper {
  private browser1: Browser | null = null;
  private browser2: Browser | null = null;
  private whiteContext: BrowserContext | null = null;
  private blackContext: BrowserContext | null = null;
  private whitePage: Page | null = null;
  private blackPage: Page | null = null;
  private userManager: TestUserManager;
  private gameManager: TestGameManager;
  private gameId: string | null = null;
  private baseUrl: string;
  private cleanupTimeout: NodeJS.Timeout | null = null;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.userManager = new TestUserManager();
    this.gameManager = new TestGameManager();
    
    // Set automatic cleanup after 60 seconds (failsafe)
    this.cleanupTimeout = setTimeout(() => {
      console.warn('Test timeout reached, forcing cleanup');
      this.cleanup();
    }, 60000);
  }

  /**
   * Setup browsers and authenticate users with cleanup tracking
   */
  async setup() {
    try {
      // Launch browsers with specific args to prevent zombie processes
      this.browser1 = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process', // Important for cleanup
        ],
      });
      CLEANUP_REGISTRY.browsers.add(this.browser1);

      this.browser2 = await firefox.launch({
        headless: process.env.HEADLESS !== 'false',
      });
      CLEANUP_REGISTRY.browsers.add(this.browser2);

      // Create contexts with timeout settings
      this.whiteContext = await this.browser1.newContext({
        viewport: { width: 1280, height: 720 },
        // Set navigation timeout to prevent hanging
        navigationTimeout: 30000,
      });
      CLEANUP_REGISTRY.contexts.add(this.whiteContext);

      this.blackContext = await this.browser2.newContext({
        viewport: { width: 1280, height: 720 },
        navigationTimeout: 30000,
      });
      CLEANUP_REGISTRY.contexts.add(this.blackContext);

      // Create pages with default timeout
      this.whitePage = await this.whiteContext.newPage();
      CLEANUP_REGISTRY.pages.add(this.whitePage);
      this.whitePage.setDefaultTimeout(15000);

      this.blackPage = await this.blackContext.newPage();
      CLEANUP_REGISTRY.pages.add(this.blackPage);
      this.blackPage.setDefaultTimeout(15000);

      // Setup error handlers
      this.whitePage.on('pageerror', error => {
        console.error('White page error:', error);
      });

      this.blackPage.on('pageerror', error => {
        console.error('Black page error:', error);
      });

      // Authenticate users
      await this.authenticatePlayer('white', this.whitePage);
      await this.authenticatePlayer('black', this.blackPage);

    } catch (error) {
      console.error('Setup failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Authenticate a player
   */
  private async authenticatePlayer(role: 'white' | 'black', page: Page) {
    const userData = TEST_USERS[role];
    
    // Use the test endpoint for quick authentication
    await page.goto(`${this.baseUrl}/test/new-game?player=${role}`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    // Wait for authentication to complete
    await page.waitForSelector('[data-testid="authenticated-user"]', {
      timeout: 10000,
    }).catch(() => {
      // Fallback to manual authentication if test endpoint fails
      return this.manualAuthentication(page, userData);
    });
  }

  /**
   * Manual authentication fallback
   */
  private async manualAuthentication(page: Page, userData: typeof TEST_USERS[keyof typeof TEST_USERS]) {
    await page.goto(`${this.baseUrl}/auth/login`);
    await page.fill('input[type="email"]', userData.email);
    await page.fill('input[type="password"]', userData.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
  }

  /**
   * Create a game with timeout protection
   */
  async createGame(): Promise<string> {
    if (!this.whitePage || !this.blackPage) {
      throw new Error('Pages not initialized');
    }

    // White player creates game via queue
    await this.whitePage.goto(`${this.baseUrl}`);
    await this.whitePage.click('[data-testid="join-queue-button"]');
    
    // Black player joins queue
    await this.blackPage.goto(`${this.baseUrl}`);
    await this.blackPage.click('[data-testid="join-queue-button"]');

    // Wait for both to be redirected to game with timeout
    const gameUrlPromise1 = this.whitePage.waitForURL(/\/game\/[\w-]+/, {
      timeout: 15000,
    });
    const gameUrlPromise2 = this.blackPage.waitForURL(/\/game\/[\w-]+/, {
      timeout: 15000,
    });

    await Promise.all([gameUrlPromise1, gameUrlPromise2]);

    // Extract game ID
    const whiteUrl = this.whitePage.url();
    const match = whiteUrl.match(/\/game\/([\w-]+)/);
    if (!match) {
      throw new Error('Could not extract game ID from URL');
    }

    this.gameId = match[1];
    return this.gameId;
  }

  /**
   * Select a ban with the black player
   */
  async selectBan(from: string, to: string) {
    if (!this.blackPage) throw new Error('Black page not initialized');

    // Wait for ban phase
    await this.blackPage.waitForSelector('[data-testid="ban-phase"]', {
      timeout: 10000,
    });

    // Click the squares to ban
    await this.blackPage.click(`[data-square="${from}"]`);
    await this.blackPage.click(`[data-square="${to}"]`);

    // Verify ban was registered
    await this.whitePage?.waitForSelector('[data-testid="banned-move-indicator"]', {
      timeout: 5000,
    });
  }

  /**
   * Make a move
   */
  async makeMove(player: 'white' | 'black', from: string, to: string) {
    const page = player === 'white' ? this.whitePage : this.blackPage;
    if (!page) throw new Error(`${player} page not initialized`);

    // Wait for move phase
    await page.waitForSelector('[data-testid="move-phase"]', {
      timeout: 10000,
    });

    // Make the move
    await page.click(`[data-square="${from}"]`);
    await page.click(`[data-square="${to}"]`);

    // Wait for move to be registered
    const otherPage = player === 'white' ? this.blackPage : this.whitePage;
    await otherPage?.waitForSelector(`[data-last-move-to="${to}"]`, {
      timeout: 5000,
    });
  }

  /**
   * Verify both players see the same game state
   */
  async verifyGameState(expectedState: {
    turn?: 'white' | 'black';
    banningPlayer?: 'white' | 'black' | null;
    lastMove?: { from: string; to: string } | null;
  }) {
    if (!this.whitePage || !this.blackPage) {
      throw new Error('Pages not initialized');
    }

    // Check turn indicator on both pages
    if (expectedState.turn) {
      const whiteTurn = await this.whitePage.$eval(
        '[data-testid="current-turn"]',
        el => el.textContent
      );
      const blackTurn = await this.blackPage.$eval(
        '[data-testid="current-turn"]',
        el => el.textContent
      );
      
      expect(whiteTurn).toContain(expectedState.turn);
      expect(blackTurn).toContain(expectedState.turn);
    }

    // Additional state verifications...
  }

  /**
   * Comprehensive cleanup with force kill
   */
  async cleanup() {
    console.log('Starting test cleanup...');
    
    // Clear the failsafe timeout
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // Close pages
    if (this.whitePage && !this.whitePage.isClosed()) {
      CLEANUP_REGISTRY.pages.delete(this.whitePage);
      await this.whitePage.close().catch(console.error);
    }
    
    if (this.blackPage && !this.blackPage.isClosed()) {
      CLEANUP_REGISTRY.pages.delete(this.blackPage);
      await this.blackPage.close().catch(console.error);
    }

    // Close contexts
    if (this.whiteContext) {
      CLEANUP_REGISTRY.contexts.delete(this.whiteContext);
      await this.whiteContext.close().catch(console.error);
    }
    
    if (this.blackContext) {
      CLEANUP_REGISTRY.contexts.delete(this.blackContext);
      await this.blackContext.close().catch(console.error);
    }

    // Close browsers
    if (this.browser1) {
      CLEANUP_REGISTRY.browsers.delete(this.browser1);
      await this.browser1.close().catch(console.error);
    }
    
    if (this.browser2) {
      CLEANUP_REGISTRY.browsers.delete(this.browser2);
      await this.browser2.close().catch(console.error);
    }

    // Clean up test data
    await this.userManager.cleanup().catch(console.error);
    await this.gameManager.cleanup().catch(console.error);

    console.log('Test cleanup completed');
  }
}

// Configure test timeout
test.setTimeout(30000);

// Main test suite
test.describe('2-Player Chess Game', () => {
  let helper: ChessGameTestHelper;

  test.beforeEach(async () => {
    helper = new ChessGameTestHelper();
    await helper.setup();
  });

  test.afterEach(async () => {
    await helper.cleanup();
  });

  test('should allow two players to join and start a game', async () => {
    const gameId = await helper.createGame();
    expect(gameId).toBeTruthy();
    
    // Verify both players are in the game
    await helper.verifyGameState({
      turn: 'white',
      banningPlayer: 'black',
    });
  });

  test('should handle ban selection and move execution', async () => {
    await helper.createGame();
    
    // Black bans e2e4
    await helper.selectBan('e2', 'e4');
    
    // White makes a different move
    await helper.makeMove('white', 'd2', 'd4');
    
    // Verify state update
    await helper.verifyGameState({
      turn: 'black',
      banningPlayer: 'white',
      lastMove: { from: 'd2', to: 'd4' },
    });
  });

  test('should prevent banned moves', async () => {
    await helper.createGame();
    
    // Black bans e2e4
    await helper.selectBan('e2', 'e4');
    
    // White tries to make banned move (should fail)
    const movePromise = helper.makeMove('white', 'e2', 'e4');
    await expect(movePromise).rejects.toThrow();
  });
});

// Cleanup on test runner exit
test.afterAll(async () => {
  await globalCleanup();
});