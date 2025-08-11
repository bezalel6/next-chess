import puppeteer from 'puppeteer';

// Utility function for fuzzy button matching
async function clickButtonWithText(page, searchText) {
  return await page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => {
      const btnText = btn.textContent?.toLowerCase() || '';
      const search = text.toLowerCase();
      // Fuzzy match - contains the text or similar
      return btnText.includes(search) || 
             btnText.replace(/\s+/g, '').includes(search.replace(/\s+/g, ''));
    });
    if (button) {
      button.click();
      return true;
    }
    return false;
  }, searchText);
}

// Utility to wait for URL change
async function waitForUrlChange(page, patterns, timeout = 10000) {
  try {
    await page.waitForFunction(
      (pats) => pats.some(pat => window.location.pathname.includes(pat)),
      { timeout },
      patterns
    );
    return true;
  } catch (e) {
    return false;
  }
}

// Player setup function
async function setupPlayer(playerNum) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  
  // Navigate to homepage
  console.log(`Player ${playerNum}: Navigating...`);
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  // Click Continue as Guest
  console.log(`Player ${playerNum}: Joining as guest...`);
  const guestClicked = await clickButtonWithText(page, 'continue as guest');
  if (!guestClicked) {
    throw new Error(`Player ${playerNum}: Could not find guest button`);
  }
  
  // Small wait for UI update
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Click Play Now
  console.log(`Player ${playerNum}: Starting game...`);
  const playClicked = await clickButtonWithText(page, 'play now');
  if (!playClicked) {
    throw new Error(`Player ${playerNum}: Could not find play button`);
  }
  
  // Wait for matchmaking or game
  await waitForUrlChange(page, ['/play/matchmaking', '/game/']);
  
  return { browser, page };
}

// Main test function
(async () => {
  let player1, player2;
  
  try {
    console.log('Setting up players in parallel...');
    
    // Setup both players in parallel
    [player1, player2] = await Promise.all([
      setupPlayer(1),
      setupPlayer(2)
    ]);
    
    console.log('Both players ready, waiting for match...');
    
    // Wait for both to be in a game
    await Promise.all([
      player1.page.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 30000 }
      ),
      player2.page.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 30000 }
      )
    ]);
    
    const gameUrl1 = await player1.page.url();
    const gameUrl2 = await player2.page.url();
    
    console.log('Game started!');
    console.log(`Player 1: ${gameUrl1}`);
    console.log(`Player 2: ${gameUrl2}`);
    
    // Verify same game
    const gameId1 = gameUrl1.split('/game/')[1];
    const gameId2 = gameUrl2.split('/game/')[1];
    
    if (gameId1 !== gameId2) {
      console.warn('Players in different games!', { gameId1, gameId2 });
    }
    
    // Let the game UI fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshots in parallel
    console.log('Capturing screenshots...');
    await Promise.all([
      player1.page.screenshot({ path: 'player1_perspective.png' }),
      player2.page.screenshot({ path: 'player2_perspective.png' })
    ]);
    
    console.log('Screenshots saved successfully!');
    
    // Brief pause before closing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('Test failed:', error.message);
    
    // Try to capture debug screenshots
    if (player1?.page) {
      await player1.page.screenshot({ path: 'player1_error.png' }).catch(() => {});
    }
    if (player2?.page) {
      await player2.page.screenshot({ path: 'player2_error.png' }).catch(() => {});
    }
    
  } finally {
    // Cleanup
    await Promise.all([
      player1?.browser?.close(),
      player2?.browser?.close()
    ].filter(Boolean));
    
    console.log('Test completed.');
  }
})();