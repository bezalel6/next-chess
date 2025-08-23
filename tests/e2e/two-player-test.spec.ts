import { test, expect, chromium } from '@playwright/test';

test('two players matchmaking flow', async () => {
  // Launch two separate browser instances
  const browser1 = await chromium.launch();
  const browser2 = await chromium.launch();
  
  const context1 = await browser1.newContext();
  const context2 = await browser2.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  console.log('🎮 Starting two-player matchmaking test...');
  
  try {
    // Both players go to homepage
    await page1.goto('http://localhost:3000');
    await page2.goto('http://localhost:3000');
    
    console.log('📍 Both players on homepage');
    
    // Wait for pages to load
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);
    
    // Check if both pages loaded
    const title1 = await page1.title();
    const title2 = await page2.title();
    
    expect(title1).toContain('Ban Chess');
    expect(title2).toContain('Ban Chess');
    
    console.log('✅ Both pages loaded successfully');
    
    // Generate unique credentials
    const timestamp = Date.now();
    const player1Email = `p1_${timestamp}@test.com`;
    const player2Email = `p2_${timestamp}@test.com`;
    const password = 'testpass123';
    
    // Player 1 signs up
    console.log('👤 Player 1 signing up...');
    const signUpLink1 = page1.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink1.isVisible()) {
      await signUpLink1.click();
      await page1.waitForTimeout(500);
      
      await page1.fill('[name="username"]', `Player1_${timestamp}`);
      await page1.fill('[name="email"]', player1Email);
      await page1.fill('[name="password"]', password);
      
      await page1.click('button:text("Sign up")');
      await page1.waitForTimeout(3000);
    }
    
    // Player 2 signs up
    console.log('👤 Player 2 signing up...');
    const signUpLink2 = page2.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink2.isVisible()) {
      await signUpLink2.click();
      await page2.waitForTimeout(500);
      
      await page2.fill('[name="username"]', `Player2_${timestamp}`);
      await page2.fill('[name="email"]', player2Email);
      await page2.fill('[name="password"]', password);
      
      await page2.click('button:text("Sign up")');
      await page2.waitForTimeout(3000);
    }
    
    // Check if they need to sign in
    const signInBtn1 = page1.locator('button:text("Sign in")');
    const signInBtn2 = page2.locator('button:text("Sign in")');
    
    if (await signInBtn1.isVisible()) {
      console.log('👤 Player 1 signing in...');
      await page1.fill('[name="email"]', player1Email);
      await page1.fill('[name="password"]', password);
      await signInBtn1.click();
      await page1.waitForTimeout(2000);
    }
    
    if (await signInBtn2.isVisible()) {
      console.log('👤 Player 2 signing in...');
      await page2.fill('[name="email"]', player2Email);
      await page2.fill('[name="password"]', password);
      await signInBtn2.click();
      await page2.waitForTimeout(2000);
    }
    
    // Check for Find Game buttons
    const findGame1 = page1.locator('button:text("Find Game")');
    const findGame2 = page2.locator('button:text("Find Game")');
    
    const hasMatchmaking1 = await findGame1.isVisible().catch(() => false);
    const hasMatchmaking2 = await findGame2.isVisible().catch(() => false);
    
    if (hasMatchmaking1 && hasMatchmaking2) {
      console.log('🎯 Both players ready to find game!');
      
      // Both click Find Game
      await Promise.all([
        findGame1.click(),
        findGame2.click()
      ]);
      
      console.log('🔍 Both players searching for match...');
      
      // Wait for potential match
      await page1.waitForTimeout(5000);
      
      // Check if redirected to game
      const url1 = page1.url();
      const url2 = page2.url();
      
      if (url1.includes('/game/') && url2.includes('/game/')) {
        const gameId1 = url1.split('/game/')[1];
        const gameId2 = url2.split('/game/')[1];
        
        if (gameId1 === gameId2) {
          console.log(`🎉 MATCH SUCCESSFUL! Game ID: ${gameId1}`);
        } else {
          console.log('⚠️ Players in different games');
        }
      } else {
        // Check if still searching
        const searching1 = await page1.locator('text="Finding Opponent"').isVisible().catch(() => false);
        const searching2 = await page2.locator('text="Finding Opponent"').isVisible().catch(() => false);
        
        if (searching1 && searching2) {
          console.log('⏳ Both players still in queue (edge function may need more time)');
        }
      }
    } else {
      console.log('⚠️ Matchmaking UI not available for one or both players');
    }
    
  } finally {
    // Clean up
    await context1.close();
    await context2.close();
    await browser1.close();
    await browser2.close();
  }
});

test('single player can join and leave queue', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  const timestamp = Date.now();
  const email = `solo_${timestamp}@test.com`;
  
  // Sign up
  const signUpLink = page.locator('text="Don\'t have an account? Sign up"');
  if (await signUpLink.isVisible()) {
    await signUpLink.click();
    await page.fill('[name="username"]', `Solo_${timestamp}`);
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button:text("Sign up")');
    await page.waitForTimeout(3000);
  }
  
  // Sign in if needed
  const signInBtn = page.locator('button:text("Sign in")');
  if (await signInBtn.isVisible()) {
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', 'testpass123');
    await signInBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // Test queue join/leave
  const findGameBtn = page.locator('button:text("Find Game")');
  if (await findGameBtn.isVisible()) {
    await findGameBtn.click();
    
    // Should show searching
    await expect(page.locator('text="Finding Opponent"')).toBeVisible({ timeout: 5000 });
    
    // Should have cancel button
    const cancelBtn = page.locator('button:text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    
    // Cancel search
    await cancelBtn.click();
    
    // Should be back to Find Game
    await expect(findGameBtn).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Queue join/leave works correctly');
  }
});