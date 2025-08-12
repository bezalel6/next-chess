import { chromium } from 'playwright';

async function runTwoPlayerGame() {
  console.log('Starting two-player Ban Chess test...');
  
  // Launch two separate browser instances
  const browser1 = await chromium.launch({
    headless: false,
    args: ['--user-data-dir=C:\\temp\\player1-' + Date.now()]
  });
  
  const browser2 = await chromium.launch({
    headless: false,
    args: ['--user-data-dir=C:\\temp\\player2-' + Date.now(), '--incognito']
  });

  try {
    // Create contexts
    const context1 = await browser1.newContext({ viewport: { width: 1280, height: 720 } });
    const context2 = await browser2.newContext({ viewport: { width: 1280, height: 720 } });
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Player 1 authentication
    console.log('Player 1: Authenticating...');
    await page1.goto('http://localhost:3000/auth/login');
    await page1.waitForSelector('[data-testid="auth-sign-in-as-guest"]', { timeout: 10000 });
    await page1.click('[data-testid="auth-sign-in-as-guest"]');
    await page1.waitForURL('http://localhost:3000/', { timeout: 10000 });
    console.log('Player 1: Authenticated');
    
    // Player 2 authentication
    console.log('Player 2: Authenticating...');
    await page2.goto('http://localhost:3000/auth/login');
    await page2.waitForSelector('[data-testid="auth-sign-in-as-guest"]', { timeout: 10000 });
    await page2.click('[data-testid="auth-sign-in-as-guest"]');
    await page2.waitForURL('http://localhost:3000/', { timeout: 10000 });
    console.log('Player 2: Authenticated');
    
    // Both join matchmaking
    console.log('Both players joining matchmaking...');
    await Promise.all([
      page1.click('button:has-text("Play Now")'),
      page2.click('button:has-text("Play Now")')
    ]);
    
    // Wait for game to start
    await Promise.all([
      page1.waitForURL(/\/game\//, { timeout: 30000 }),
      page2.waitForURL(/\/game\//, { timeout: 30000 })
    ]);
    
    console.log('Game started!');
    
    // Take screenshots
    await page1.screenshot({ path: 'e2e/screenshots/player1_game_start.png' });
    await page2.screenshot({ path: 'e2e/screenshots/player2_game_start.png' });
    
    // Play game for 10 moves
    for (let move = 1; move <= 10; move++) {
      console.log(`Playing move ${move}...`);
      
      // Check for ban phase on both players
      const player1HasBan = await page1.locator('text=/Select opponent.*move to ban/i').isVisible({ timeout: 1000 }).catch(() => false);
      const player2HasBan = await page2.locator('text=/Select opponent.*move to ban/i').isVisible({ timeout: 1000 }).catch(() => false);
      
      if (player1HasBan) {
        console.log('Player 1 is banning...');
        // Click on a piece to see moves
        const pieces = await page1.locator('.cg-board piece').all();
        if (pieces.length > 0) {
          await pieces[0].click();
          await page1.waitForTimeout(500);
          const moves = await page1.locator('.cg-move-dest, .legal-move').all();
          if (moves.length > 0) {
            await moves[0].click();
            console.log('Player 1 banned a move');
          }
        }
      }
      
      if (player2HasBan) {
        console.log('Player 2 is banning...');
        const pieces = await page2.locator('.cg-board piece').all();
        if (pieces.length > 0) {
          await pieces[0].click();
          await page2.waitForTimeout(500);
          const moves = await page2.locator('.cg-move-dest, .legal-move').all();
          if (moves.length > 0) {
            await moves[0].click();
            console.log('Player 2 banned a move');
          }
        }
      }
      
      await page1.waitForTimeout(1000);
      await page2.waitForTimeout(1000);
      
      // Try to make moves
      for (const [page, name] of [[page1, 'Player 1'], [page2, 'Player 2']]) {
        const pieces = await page.locator('.cg-board piece').all();
        for (const piece of pieces) {
          await piece.click();
          await page.waitForTimeout(300);
          const dests = await page.locator('.cg-move-dest').all();
          if (dests.length > 0) {
            await dests[0].click();
            console.log(`${name} made a move`);
            break;
          }
        }
      }
      
      // Take screenshots every 3 moves
      if (move % 3 === 0) {
        await page1.screenshot({ path: `e2e/screenshots/player1_move${move}.png` });
        await page2.screenshot({ path: `e2e/screenshots/player2_move${move}.png` });
      }
      
      await page1.waitForTimeout(2000);
    }
    
    console.log('Test completed successfully!');
    
  } finally {
    // Cleanup
    await browser1.close();
    await browser2.close();
  }
}

runTwoPlayerGame().catch(console.error);