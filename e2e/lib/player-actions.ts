import { Page } from '@playwright/test';

export class PlayerActions {
  constructor(private page: Page, private playerName: string) {}

  async authenticateAsGuest() {
    console.log(`${this.playerName}: Navigating to login page`);
    await this.page.goto('http://localhost:3000/auth/login');
    await this.page.waitForLoadState('networkidle');
    
    const guestButton = this.page.getByTestId('auth-sign-in-as-guest');
    if (await guestButton.isVisible()) {
      console.log(`${this.playerName}: Clicking Continue as Guest`);
      await guestButton.click();
      await this.page.waitForURL('http://localhost:3000/', { timeout: 10000 });
      console.log(`${this.playerName}: Authenticated successfully`);
    } else {
      console.log(`${this.playerName}: Guest button not found, checking if already authenticated`);
    }
  }

  async joinQueue() {
    console.log(`${this.playerName}: Checking for active games or joining queue`);
    
    // Check for active game button first
    const activeGameButton = this.page.locator('button:has-text("Active Game")');
    if (await activeGameButton.isVisible({ timeout: 1000 })) {
      console.log(`${this.playerName}: Found active game, joining...`);
      await activeGameButton.click();
      await this.page.waitForURL('**/game/**', { timeout: 10000 });
      return 'active-game';
    }
    
    // Try to join new game queue
    const playButton = this.page.locator('button:has-text("Play Now")');
    if (await playButton.isVisible() && await playButton.isEnabled()) {
      console.log(`${this.playerName}: Clicking Play Now`);
      await playButton.click();
      
      // Wait for either queue UI or direct game redirect
      await Promise.race([
        this.page.waitForSelector('text=/Finding opponent/i', { timeout: 5000 }),
        this.page.waitForURL('**/game/**', { timeout: 5000 })
      ]).catch(() => {});
      
      return 'queue';
    }
    
    console.log(`${this.playerName}: Unable to join queue`);
    return 'failed';
  }

  async waitForGameStart() {
    console.log(`${this.playerName}: Waiting for game to start`);
    try {
      await this.page.waitForURL('**/game/**', { timeout: 30000 });
      await this.page.waitForSelector('.cg-board, [class*="board"]', { timeout: 10000 });
      console.log(`${this.playerName}: Game started!`);
      return true;
    } catch (error) {
      console.log(`${this.playerName}: Game did not start within timeout`);
      return false;
    }
  }

  async detectBanPhase(): Promise<boolean> {
    const banIndicators = [
      this.page.locator('text=/Select opponent.*move to ban/i'),
      this.page.locator('.ban-phase-overlay'),
      this.page.locator('[data-testid="ban-phase-indicator"]'),
      this.page.locator('text=/Ban Phase/i'),
      this.page.locator('text=/Choose a move to ban/i')
    ];
    
    for (const indicator of banIndicators) {
      if (await indicator.isVisible({ timeout: 500 })) {
        console.log(`${this.playerName}: Ban phase detected`);
        return true;
      }
    }
    
    return false;
  }

  async performBan() {
    console.log(`${this.playerName}: Performing ban action`);
    
    // Try to click on a piece to see available moves
    const pieces = await this.page.locator('.cg-board piece').all();
    
    for (const piece of pieces) {
      try {
        await piece.click();
        await this.page.waitForTimeout(300);
        
        // Look for legal move indicators
        const legalMoves = this.page.locator('.legal, .selected, [class*="legal-move"], .cg-move-dest');
        const moveCount = await legalMoves.count();
        
        if (moveCount > 0) {
          console.log(`${this.playerName}: Found ${moveCount} legal moves, banning the first one`);
          await legalMoves.first().click();
          
          // Check for confirm button
          const confirmButton = this.page.locator('button:has-text("Confirm"), [data-testid="confirm-ban"]');
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          console.log(`${this.playerName}: Ban completed`);
          return true;
        }
      } catch (error) {
        // Continue to next piece
      }
    }
    
    console.log(`${this.playerName}: Could not complete ban`);
    return false;
  }

  async makeMove() {
    console.log(`${this.playerName}: Attempting to make a move`);
    
    const board = this.page.locator('.cg-board, [class*="board"]').first();
    const pieces = await board.locator('piece').all();
    
    for (const piece of pieces) {
      try {
        await piece.click();
        await this.page.waitForTimeout(300);
        
        // Look for legal move destinations
        const destinations = this.page.locator('.cg-move-dest, .legal-move, [class*="legal"]');
        const destCount = await destinations.count();
        
        if (destCount > 0) {
          console.log(`${this.playerName}: Found ${destCount} legal moves, playing the first one`);
          await destinations.first().click();
          console.log(`${this.playerName}: Move completed`);
          return true;
        }
      } catch (error) {
        // Continue to next piece
      }
    }
    
    console.log(`${this.playerName}: Could not make a move`);
    return false;
  }

  async captureScreenshot(filename: string) {
    const path = `e2e/screenshots/${filename}`;
    await this.page.screenshot({ path, fullPage: false });
    console.log(`${this.playerName}: Screenshot saved to ${path}`);
  }

  async getCurrentTurn(): Promise<'white' | 'black' | null> {
    try {
      // Check various turn indicators
      const turnIndicators = [
        { selector: '.turn-indicator', attribute: 'data-turn' },
        { selector: '[data-testid="current-turn"]', attribute: 'data-value' },
        { selector: '.player-card.active', attribute: 'data-color' }
      ];
      
      for (const { selector, attribute } of turnIndicators) {
        const element = this.page.locator(selector);
        if (await element.isVisible({ timeout: 500 })) {
          const turn = await element.getAttribute(attribute);
          return turn as 'white' | 'black';
        }
      }
      
      // Check text content
      const pageText = await this.page.textContent('body');
      if (pageText?.includes("White's turn") || pageText?.includes("White to move")) return 'white';
      if (pageText?.includes("Black's turn") || pageText?.includes("Black to move")) return 'black';
      
      return null;
    } catch {
      return null;
    }
  }
}