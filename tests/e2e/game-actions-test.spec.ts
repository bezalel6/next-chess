import { test, expect } from '@playwright/test';

test.describe('Game Actions (Moves and Bans)', () => {
  test('players can make moves and bans', async ({ browser }) => {
    console.log('\n=== TESTING GAME ACTIONS ===\n');
    
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Enable console logging
    page1.on('console', msg => {
      if (msg.text().includes('ERROR') || msg.text().includes('Failed')) {
        console.log('PAGE 1 ERROR:', msg.text());
      }
    });
    page2.on('console', msg => {
      if (msg.text().includes('ERROR') || msg.text().includes('Failed')) {
        console.log('PAGE 2 ERROR:', msg.text());
      }
    });
    
    try {
      // Both players sign in as guest
      console.log('📍 Signing in both players...');
      
      await page1.goto('http://localhost:3000');
      await page1.click('button:has-text("Continue as Guest")');
      await page1.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 10000 });
      
      await page2.goto('http://localhost:3000');
      await page2.click('button:has-text("Continue as Guest")');
      await page2.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 10000 });
      
      // Start matchmaking
      console.log('📍 Starting matchmaking...');
      await page1.click('button:has-text("Find Game")');
      await page1.waitForTimeout(500);
      await page2.click('button:has-text("Find Game")');
      
      // Wait for game redirect
      console.log('⏳ Waiting for game...');
      const gameUrl = await page1.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 10000 }
      );
      
      const gameId = await page1.evaluate(() => window.location.pathname.split('/').pop());
      console.log('✅ Game started:', gameId);
      
      // Wait for board to render
      await page1.waitForSelector('h1:has-text("Ban Chess Game")', { timeout: 5000 });
      await page2.waitForSelector('h1:has-text("Ban Chess Game")', { timeout: 5000 });
      
      // Determine who is white and who is black
      const player1Info = await page1.textContent('p:has-text("Turn")');
      const player2Info = await page2.textContent('p:has-text("Turn")');
      
      console.log('Player 1 sees:', player1Info);
      console.log('Player 2 sees:', player2Info);
      
      // Check initial state - should be ban phase
      const nextAction1 = await page1.textContent('p:has-text("Next Action")');
      console.log('Initial state:', nextAction1);
      
      if (!nextAction1?.includes('Ban')) {
        console.log('❌ Not in ban phase at start');
        return;
      }
      
      // TEST 1: Black player bans a white move (e2-e4)
      console.log('\n📍 TEST 1: Black bans e2-e4...');
      
      // Find which player is black
      const blackPage = player1Info?.includes('Black') ? page1 : page2;
      const whitePage = player1Info?.includes('White') ? page1 : page2;
      
      // Black clicks e2 then e4 to ban
      await blackPage.click('[data-square="e2"]');
      await blackPage.waitForTimeout(500);
      await blackPage.click('[data-square="e4"]');
      
      // Wait for state update
      await blackPage.waitForTimeout(1000);
      
      // Check if ban was registered
      const nextAction2 = await whitePage.textContent('p:has-text("Next Action")');
      if (nextAction2?.includes('Make a move')) {
        console.log('✅ Ban registered, white\'s turn to move');
      } else {
        console.log('❌ Ban not registered:', nextAction2);
      }
      
      // TEST 2: White makes a different move (d2-d4)
      console.log('\n📍 TEST 2: White moves d2-d4...');
      
      await whitePage.click('[data-square="d2"]');
      await whitePage.waitForTimeout(500);
      await whitePage.click('[data-square="d4"]');
      
      // Wait for state update
      await whitePage.waitForTimeout(1000);
      
      // Check if move was made
      const fen = await whitePage.evaluate(() => {
        const fenElement = document.querySelector('code');
        return fenElement?.textContent;
      });
      
      if (fen && !fen.includes('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) {
        console.log('✅ Move was made, board changed');
        console.log('New FEN:', fen);
      } else {
        console.log('❌ Move not registered');
      }
      
      // Check turn changed
      const turnAfterMove = await blackPage.textContent('p:has-text("Turn")');
      if (turnAfterMove?.includes('Black')) {
        console.log('✅ Turn switched to black');
      } else {
        console.log('❌ Turn did not switch:', turnAfterMove);
      }
      
      // Take screenshots
      await page1.screenshot({ path: 'test-results/game-actions-player1.png' });
      await page2.screenshot({ path: 'test-results/game-actions-player2.png' });
      console.log('📸 Screenshots saved');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});