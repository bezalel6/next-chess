import puppeteer from 'puppeteer';

async function testTwoPlayers() {
  console.log('Starting two-player test...');
  
  // Launch first browser (normal mode)
  const browser1 = await puppeteer.launch({
    headless: false,
    args: ['--window-size=900,800', '--window-position=0,0']
  });
  
  // Launch second browser (incognito mode for separate session)
  const browser2 = await puppeteer.launch({
    headless: false,
    args: ['--window-size=900,800', '--window-position=920,0', '--incognito']
  });
  
  try {
    // Create pages
    const page1 = await browser1.newPage();
    const page2 = await browser2.newPage();
    
    // Set viewport
    await page1.setViewport({ width: 800, height: 700 });
    await page2.setViewport({ width: 800, height: 700 });
    
    // Navigate both to the app
    console.log('Navigating to app...');
    await Promise.all([
      page1.goto('http://localhost:3000', { waitUntil: 'networkidle0' }),
      page2.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
    ]);
    
    // Sign in as guest for both users
    console.log('Signing in as guests...');
    
    // Player 1 - Continue as Guest
    await page1.waitForSelector('button', { timeout: 5000 });
    const guestButton1 = await page1.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Guest'));
    });
    if (guestButton1) {
      await guestButton1.click();
    }
    
    // Wait for Player 1 to be logged in
    await page1.waitForSelector('button:has-text("Play Now")', { timeout: 10000 }).catch(() => {
      // Try alternative selector
      return page1.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent?.includes('Play Now'));
      }, { timeout: 10000 });
    });
    
    console.log('Player 1 logged in as guest');
    
    // Player 2 - Continue as Guest
    await page2.waitForSelector('button', { timeout: 5000 });
    const guestButton2 = await page2.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Guest'));
    });
    if (guestButton2) {
      await guestButton2.click();
    }
    
    // Wait for Player 2 to be logged in
    await page2.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => btn.textContent?.includes('Play Now'));
    }, { timeout: 10000 });
    
    console.log('Player 2 logged in as guest');
    
    // Small delay to ensure both are ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Both players join the queue
    console.log('Both players joining queue...');
    
    // Player 1 clicks Play Now
    await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const playButton = buttons.find(btn => btn.textContent?.includes('Play Now'));
      if (playButton) playButton.click();
    });
    
    console.log('Player 1 joined queue');
    
    // Small delay then Player 2 joins
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Player 2 clicks Play Now
    await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const playButton = buttons.find(btn => btn.textContent?.includes('Play Now'));
      if (playButton) playButton.click();
    });
    
    console.log('Player 2 joined queue');
    
    // Wait for game to start (should redirect to game page)
    console.log('Waiting for game to start...');
    await Promise.all([
      page1.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
      page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {})
    ]);
    
    // Check if we're on a game page
    const url1 = page1.url();
    const url2 = page2.url();
    
    if (url1.includes('/game/') && url2.includes('/game/')) {
      console.log('✅ Game started successfully!');
      console.log('Player 1 URL:', url1);
      console.log('Player 2 URL:', url2);
      
      // Keep browsers open for manual testing
      console.log('\nBrowsers will stay open for manual testing.');
      console.log('Press Ctrl+C to close them.');
      
      // Keep the script running
      await new Promise(() => {});
    } else {
      console.log('⚠️ Game did not start. Current URLs:');
      console.log('Player 1:', url1);
      console.log('Player 2:', url2);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testTwoPlayers().catch(console.error);