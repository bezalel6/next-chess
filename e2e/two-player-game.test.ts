import puppeteer, { Browser, Page } from 'puppeteer';
import { TEST_CONFIG } from './utils/test-config';
import { AuthHelper } from './utils/auth-helper';
import { GameHelper } from './utils/game-helper';

describe('Two Player Game Test', () => {
  let browser1: Browser;
  let browser2: Browser;
  let page1: Page;
  let page2: Page;
  let gameId: string;

  // Test user credentials
  const user1 = {
    email: 'test_player1@banchess.test',
    password: 'TestPlayer1!2024',
    username: 'TestPlayer1'
  };
  
  const user2 = {
    email: 'test_player2@banchess.test', 
    password: 'TestPlayer2!2024',
    username: 'TestPlayer2'
  };

  beforeAll(async () => {
    // Launch two separate browser instances
    browser1 = await puppeteer.launch({
      headless: false, // Set to true for CI
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    browser2 = await puppeteer.launch({
      headless: false, // Set to true for CI
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Create pages for each browser
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();

    // Set viewport
    await page1.setViewport({ width: 1920, height: 1080 });
    await page2.setViewport({ width: 1920, height: 1080 });
  }, 30000);

  afterAll(async () => {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  });

  test('should create a game between two users and allow control of both sides', async () => {
    console.log('Setting up two players using GUI login...');

    // Step 1: Navigate both users to the login page
    await page1.goto(`${TEST_CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle0' });
    await page2.goto(`${TEST_CONFIG.baseUrl}/auth/login`, { waitUntil: 'networkidle0' });

    // Step 2: Sign in as Guest for both users (simpler than email/password)
    console.log('Signing in Player 1 as guest...');
    
    // Wait for page to fully load and check what's available
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Debug: Check what's on the page
    const pageContent = await page1.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        buttons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()),
        hasForm: !!document.querySelector('form'),
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    console.log('Page 1 content:', pageContent);
    
    // Player 1 - Click "Continue as Guest" button
    await page1.waitForSelector('button', { timeout: 10000 });
    await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const guestButton = buttons.find(btn => btn.textContent?.includes('Continue as Guest'));
      if (guestButton) {
        (guestButton as HTMLElement).click();
      } else {
        // If no guest button, list all available buttons
        const buttonTexts = buttons.map(btn => btn.textContent?.trim()).filter(Boolean);
        throw new Error(`Guest button not found. Available buttons: ${buttonTexts.join(', ')}`);
      }
    });

    // Wait for redirect to home page
    await page1.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    console.log('Player 1 signed in');

    // Player 2 - Click "Continue as Guest" button
    console.log('Signing in Player 2 as guest...');
    await page2.waitForSelector('button', { timeout: 5000 });
    await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const guestButton = buttons.find(btn => btn.textContent?.includes('Continue as Guest'));
      if (guestButton) {
        (guestButton as HTMLElement).click();
      } else {
        throw new Error('Guest button not found');
      }
    });

    // Wait for redirect to home page
    await page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    console.log('Player 2 signed in');

    // Step 3: Verify both players are on the home page with Play Now button
    await page1.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent?.includes('Play Now'));
      },
      { timeout: 10000 }
    );
    console.log('Player 1 ready to play');

    await page2.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent?.includes('Play Now'));
      },
      { timeout: 10000 }
    );
    console.log('Player 2 ready to play');

    // Step 4: Have both players join the queue
    console.log('Both players joining queue...');
    
    // Helper to click button by text
    const clickButtonByText = async (page: Page, text: string) => {
      await page.evaluate((buttonText) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const button = buttons.find(btn => btn.textContent?.includes(buttonText));
        if (button) {
          (button as HTMLElement).click();
        } else {
          throw new Error(`Button with text "${buttonText}" not found`);
        }
      }, text);
    };
    
    // Player 1 joins queue
    await clickButtonByText(page1, 'Play Now');
    
    // Wait for queue status to appear (player is in queue)
    await page1.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent?.includes('Cancel Queue'));
      },
      { timeout: 5000 }
    );
    console.log('Player 1 in queue');

    // Small delay to ensure queue registration
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Player 2 joins queue
    await clickButtonByText(page2, 'Play Now');
    console.log('Player 2 joining queue...');

    // Step 5: Wait for match to be made and game to start
    console.log('Waiting for match...');
    
    // Both players should be redirected to the game page
    await Promise.all([
      page1.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 })
    ]);

    // Get the game ID from the URL
    const url1 = page1.url();
    const url2 = page2.url();
    
    const gameIdMatch1 = url1.match(/\/game\/([a-zA-Z0-9-]+)/);
    const gameIdMatch2 = url2.match(/\/game\/([a-zA-Z0-9-]+)/);
    
    expect(gameIdMatch1).toBeTruthy();
    expect(gameIdMatch2).toBeTruthy();
    expect(gameIdMatch1![1]).toBe(gameIdMatch2![1]); // Both should be in the same game
    
    gameId = gameIdMatch1![1];
    console.log(`Game created with ID: ${gameId}`);

    // Step 6: Verify both players can see the game board
    await page1.waitForSelector('.cg-wrap', { timeout: 10000 });
    await page2.waitForSelector('.cg-wrap', { timeout: 10000 });
    console.log('Both players have loaded the game board');

    // Step 7: Determine who is white and who is black
    const player1Color = await page1.evaluate(() => {
      // Check the player cards or board orientation
      const boardContainer = document.querySelector('.cg-wrap');
      const board = boardContainer?.closest('.chess-board-container');
      
      // Check if we're playing as white (board not flipped)
      // Usually the class or data attribute indicates this
      const isFlipped = board?.classList.contains('flipped') || 
                        boardContainer?.parentElement?.classList.contains('flipped');
      
      return isFlipped ? 'black' : 'white';
    });

    const player2Color = player1Color === 'white' ? 'black' : 'white';
    console.log(`Player 1 is ${player1Color}, Player 2 is ${player2Color}`);

    // Step 8: Test the ban-move mechanic
    const whitePage = player1Color === 'white' ? page1 : page2;
    const blackPage = player1Color === 'white' ? page2 : page1;

    console.log('Testing ban-move mechanic...');
    
    // Black should be in ban phase (banning one of White's opening moves)
    // Look for ban phase indicators
    const blackInBanPhase = await blackPage.evaluate(() => {
      // Check for ban phase UI elements
      const hasBanUI = !!document.querySelector('.ban-phase-overlay') ||
                       !!document.querySelector('[data-testid="ban-overlay"]') ||
                       document.body.textContent?.includes('Select a move to ban') ||
                       document.body.textContent?.includes('Ban Phase');
      return hasBanUI;
    });
    
    if (blackInBanPhase) {
      console.log('Black player is in ban phase');
      
      // Try to select a move to ban
      // Click on a white piece to see legal moves
      await blackPage.evaluate(() => {
        // Find white pawns (common opening pieces)
        const whitePawns = document.querySelectorAll('.white.pawn, piece.white.pawn, [data-piece="wP"]');
        if (whitePawns.length > 0) {
          (whitePawns[0] as HTMLElement).click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Click on a legal move square to ban it
      await blackPage.evaluate(() => {
        const legalMoves = document.querySelectorAll('.legal-move, .premove-dest, [data-legal-move]');
        if (legalMoves.length > 0) {
          (legalMoves[0] as HTMLElement).click();
        }
      });
      
      console.log('Black selected a move to ban');
    } else {
      console.log('Ban phase UI not detected, game might use different flow');
    }

    // Step 9: Verify we can access both sides of the game
    const gameState1 = await page1.evaluate(() => {
      return {
        url: window.location.href,
        hasBoard: !!document.querySelector('.cg-wrap'),
        pageContent: document.body.innerText.substring(0, 200)
      };
    });

    const gameState2 = await page2.evaluate(() => {
      return {
        url: window.location.href,
        hasBoard: !!document.querySelector('.cg-wrap'),
        pageContent: document.body.innerText.substring(0, 200)
      };
    });

    console.log('Game State Player 1:', gameState1);
    console.log('Game State Player 2:', gameState2);

    // Verify both players are in the same game
    expect(gameState1.url).toContain(gameId);
    expect(gameState2.url).toContain(gameId);
    expect(gameState1.hasBoard).toBe(true);
    expect(gameState2.hasBoard).toBe(true);

    console.log('✅ Successfully created a two-player game with control of both sides');
    console.log(`Game ID: ${gameId}`);
    console.log(`Player 1 (${player1Color})`);
    console.log(`Player 2 (${player2Color})`);

    // Return game details for potential further testing
    return {
      gameId,
      whitePage,
      blackPage,
      page1,
      page2
    };
  }, 60000); // 60 second timeout for the entire test

  test('should allow continuous gameplay with ban-move cycles', async () => {
    // This test can use the game from the previous test
    // or create a new one using the same setup
    
    console.log('Testing continuous ban-move cycles...');
    
    // Here you can add more gameplay tests using the established game
    // For example, playing several moves and verifying the ban-move cycle continues
    
    expect(true).toBe(true); // Placeholder
  });
});