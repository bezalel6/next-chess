import { chromium } from 'playwright';

async function runPlayer1() {
  const context = await chromium.launchPersistentContext(
    `C:\\temp\\player1-${Date.now()}`,
    {
      headless: false,
      viewport: { width: 960, height: 1080 }
    }
  );
  
  const page = await context.newPage();
  
  console.log('[Player 1] Navigating to login...');
  await page.goto('http://localhost:3000/auth/login');
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  
  // Look for guest button
  const guestButton = page.getByTestId('auth-sign-in-as-guest');
  const guestButtonVisible = await guestButton.isVisible();
  console.log(`[Player 1] Guest button visible: ${guestButtonVisible}`);
  
  if (guestButtonVisible) {
    console.log('[Player 1] Clicking Continue as Guest...');
    await guestButton.click();
    
    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    console.log('[Player 1] Authenticated! Now on home page');
  }
  
  // Wait a bit for page to stabilize
  await page.waitForTimeout(2000);
  
  // Check for Play Now button
  const playButton = page.locator('button:has-text("Play Now")');
  const playButtonVisible = await playButton.isVisible();
  const playButtonEnabled = await playButton.isEnabled();
  
  console.log(`[Player 1] Play Now button - Visible: ${playButtonVisible}, Enabled: ${playButtonEnabled}`);
  
  if (playButtonVisible && playButtonEnabled) {
    console.log('[Player 1] Clicking Play Now to join queue...');
    await playButton.click();
    
    // Wait for queue UI
    const queueIndicator = page.locator('text=/Finding opponent/i');
    const inQueue = await queueIndicator.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (inQueue) {
      console.log('[Player 1] Successfully joined queue! Waiting for opponent...');
    } else {
      console.log('[Player 1] May have directly joined a game or queue state unclear');
    }
  } else {
    console.log('[Player 1] Cannot join queue - button not available');
    
    // Check for active game
    const activeGameButton = page.locator('button:has-text("Active Game")');
    if (await activeGameButton.isVisible()) {
      console.log('[Player 1] Found active game button, clicking...');
      await activeGameButton.click();
    }
  }
  
  // Monitor for game start
  console.log('[Player 1] Monitoring for game start...');
  let gameStarted = false;
  
  for (let i = 0; i < 60; i++) { // Check for 60 seconds
    if (page.url().includes('/game/')) {
      gameStarted = true;
      console.log('[Player 1] Game started! URL:', page.url());
      break;
    }
    await page.waitForTimeout(1000);
  }
  
  if (gameStarted) {
    // Wait for board to load
    await page.waitForSelector('.cg-board', { timeout: 10000 });
    console.log('[Player 1] Chess board loaded!');
    
    // Keep monitoring game state
    while (true) {
      // Check for ban phase
      const banPhase = await page.locator('text=/Select opponent.*move to ban/i').isVisible({ timeout: 500 }).catch(() => false);
      
      if (banPhase) {
        console.log('[Player 1] BAN PHASE DETECTED! Need to select a move to ban');
        
        // Try to click on opponent pieces
        const pieces = await page.locator('.cg-board piece').all();
        for (const piece of pieces.slice(0, 3)) {
          await piece.click();
          await page.waitForTimeout(300);
          
          const legalMoves = page.locator('.cg-move-dest');
          if (await legalMoves.count() > 0) {
            console.log('[Player 1] Clicking first legal move to ban it');
            await legalMoves.first().click();
            break;
          }
        }
      }
      
      // Check if it's our turn to move
      const myTurn = await page.locator('text=/Your turn/i').isVisible({ timeout: 500 }).catch(() => false);
      
      if (myTurn && !banPhase) {
        console.log('[Player 1] My turn to move!');
        
        // Try to make a move
        const pieces = await page.locator('.cg-board piece').all();
        for (const piece of pieces.slice(0, 5)) {
          await piece.click();
          await page.waitForTimeout(300);
          
          const destinations = page.locator('.cg-move-dest');
          if (await destinations.count() > 0) {
            console.log('[Player 1] Making a move');
            await destinations.first().click();
            break;
          }
        }
      }
      
      await page.waitForTimeout(2000);
    }
  } else {
    console.log('[Player 1] Game did not start within timeout');
  }
}

runPlayer1().catch(console.error);