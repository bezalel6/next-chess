import { Page } from 'puppeteer';
import { TEST_CONFIG } from './test-config';

export class GameHelper {
  /**
   * Join the matchmaking queue
   */
  static async joinQueue(page: Page, playerName: string): Promise<void> {
    console.log(`[${playerName}] Joining queue...`);
    
    // Click join queue button
    await page.click(TEST_CONFIG.selectors.joinQueueButton);
    
    // Wait for queue status to update
    await page.waitForSelector(TEST_CONFIG.selectors.leaveQueueButton, {
      timeout: 5000,
    });
    
    console.log(`[${playerName}] Joined queue successfully`);
  }

  /**
   * Wait for a game to start
   */
  static async waitForGameStart(page: Page, playerName: string): Promise<string> {
    console.log(`[${playerName}] Waiting for game to start...`);
    
    // Wait for navigation to game page
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/game/'),
      { timeout: 30000 }
    );
    
    const gameId = page.url().split('/game/')[1];
    console.log(`[${playerName}] Game started! ID: ${gameId}`);
    
    // Wait for board to be visible
    await page.waitForSelector(TEST_CONFIG.selectors.board, {
      timeout: 10000,
    });
    
    return gameId;
  }

  /**
   * Get the current player's color
   */
  static async getPlayerColor(page: Page): Promise<'white' | 'black'> {
    const color = await page.evaluate(() => {
      // Check orientation or player info to determine color
      const playerInfo = document.querySelector('[data-testid="player-info"]');
      if (playerInfo?.textContent?.includes('white')) return 'white';
      if (playerInfo?.textContent?.includes('black')) return 'black';
      
      // Fallback: check board orientation
      const board = document.querySelector('.cg-wrap');
      return board?.classList.contains('orientation-black') ? 'black' : 'white';
    });
    
    return color || 'white';
  }

  /**
   * Ban a move (click on opponent's piece and then destination)
   */
  static async banMove(page: Page, from: string, to: string, playerName: string): Promise<void> {
    console.log(`[${playerName}] Banning move ${from}-${to}...`);
    
    // Wait for ban phase indicator
    await page.waitForSelector('[data-testid="ban-phase-indicator"]', {
      timeout: 10000,
    });
    
    // Click on the piece at 'from' square
    await page.click(`[data-square="${from}"]`);
    await page.waitForTimeout(500); // Small delay for animation
    
    // Click on the destination square
    await page.click(`[data-square="${to}"]`);
    await page.waitForTimeout(500);
    
    console.log(`[${playerName}] Banned move ${from}-${to}`);
  }

  /**
   * Make a move (drag piece from one square to another)
   */
  static async makeMove(page: Page, from: string, to: string, playerName: string): Promise<void> {
    console.log(`[${playerName}] Making move ${from}-${to}...`);
    
    // Wait for our turn (no ban overlay)
    await page.waitForSelector('[data-testid="ban-phase-indicator"]', {
      hidden: true,
      timeout: 10000,
    });
    
    // Get square positions
    const fromElement = await page.$(`[data-square="${from}"]`);
    const toElement = await page.$(`[data-square="${to}"]`);
    
    if (!fromElement || !toElement) {
      throw new Error(`Square not found: ${from} or ${to}`);
    }
    
    // Get bounding boxes
    const fromBox = await fromElement.boundingBox();
    const toBox = await toElement.boundingBox();
    
    if (!fromBox || !toBox) {
      throw new Error('Could not get square positions');
    }
    
    // Calculate center points
    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const toX = toBox.x + toBox.width / 2;
    const toY = toBox.y + toBox.height / 2;
    
    // Perform drag and drop
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    
    console.log(`[${playerName}] Made move ${from}-${to}`);
  }

  /**
   * Wait for opponent's move
   */
  static async waitForOpponentMove(page: Page, playerName: string): Promise<void> {
    console.log(`[${playerName}] Waiting for opponent's move...`);
    
    // Wait for our turn indicator or ban phase
    await page.waitForFunction(
      () => {
        const banIndicator = document.querySelector('[data-testid="ban-phase-indicator"]');
        const turnIndicator = document.querySelector('[data-testid="your-turn"]');
        return banIndicator || turnIndicator;
      },
      { timeout: 30000 }
    );
    
    console.log(`[${playerName}] Opponent moved, our turn now`);
  }

  /**
   * Check if the game is over
   */
  static async isGameOver(page: Page): Promise<boolean> {
    const gameOver = await page.evaluate(() => {
      const gameOverOverlay = document.querySelector('[data-testid="game-over"]');
      return !!gameOverOverlay;
    });
    
    return gameOver;
  }

  /**
   * Get game result
   */
  static async getGameResult(page: Page): Promise<string> {
    const result = await page.evaluate(() => {
      const resultElement = document.querySelector('[data-testid="game-result"]');
      return resultElement?.textContent || 'unknown';
    });
    
    return result;
  }
}