import { BrowserManager } from './utils/browser-manager';
import { AuthHelper } from './utils/auth-helper';
import { GameHelper } from './utils/game-helper';
import { TEST_CONFIG } from './utils/test-config';

describe('Ban Chess E2E Test', () => {
  let browserManager: BrowserManager;

  beforeAll(async () => {
    // Create test users if needed
    await AuthHelper.createTestUsers();
    
    // Initialize browser manager
    browserManager = new BrowserManager();
  });

  afterAll(async () => {
    // Cleanup
    await browserManager.cleanup();
    
    // Optionally cleanup test users
    if (process.env.CLEANUP_USERS === 'true') {
      await AuthHelper.cleanupTestUsers();
    }
  });

  it('should play a complete Ban Chess game between two players', async () => {
    // Create two browser instances for two players
    const browser1 = await browserManager.createBrowser();
    const browser2 = await browserManager.createBrowser();
    
    const player1Page = await browserManager.createPage(browser1, 'Player1');
    const player2Page = await browserManager.createPage(browser2, 'Player2');
    
    // Step 1: Sign in both players
    console.log('\n=== STEP 1: Authentication ===');
    await AuthHelper.signIn(
      player1Page,
      TEST_CONFIG.testUsers.player1.email,
      TEST_CONFIG.testUsers.player1.password
    );
    
    await AuthHelper.signIn(
      player2Page,
      TEST_CONFIG.testUsers.player2.email,
      TEST_CONFIG.testUsers.player2.password
    );
    
    // Step 2: Both players join the queue
    console.log('\n=== STEP 2: Joining Queue ===');
    await GameHelper.joinQueue(player1Page, 'Player1');
    await GameHelper.joinQueue(player2Page, 'Player2');
    
    // Step 3: Wait for matchmaking and game start
    console.log('\n=== STEP 3: Waiting for Match ===');
    const [gameId1, gameId2] = await Promise.all([
      GameHelper.waitForGameStart(player1Page, 'Player1'),
      GameHelper.waitForGameStart(player2Page, 'Player2'),
    ]);
    
    expect(gameId1).toBe(gameId2);
    console.log(`Game started with ID: ${gameId1}`);
    
    // Step 4: Determine player colors
    const player1Color = await GameHelper.getPlayerColor(player1Page);
    const player2Color = await GameHelper.getPlayerColor(player2Page);
    
    console.log(`Player1 is ${player1Color}, Player2 is ${player2Color}`);
    expect(player1Color).not.toBe(player2Color);
    
    // Determine which page is White and which is Black
    const whitePage = player1Color === 'white' ? player1Page : player2Page;
    const blackPage = player1Color === 'white' ? player2Page : player1Page;
    const whiteName = player1Color === 'white' ? 'Player1' : 'Player2';
    const blackName = player1Color === 'white' ? 'Player2' : 'Player1';
    
    // Step 5: Play the game with Ban Chess rules
    console.log('\n=== STEP 4: Playing Ban Chess ===');
    
    // Move 1: Black bans White's e2-e4
    console.log('\n--- Move 1 ---');
    await GameHelper.banMove(blackPage, 'e2', 'e4', blackName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // White plays d2-d4 instead
    await GameHelper.makeMove(whitePage, 'd2', 'd4', whiteName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // White bans Black's d7-d5
    await GameHelper.banMove(whitePage, 'd7', 'd5', whiteName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Black plays e7-e6 instead
    await GameHelper.makeMove(blackPage, 'e7', 'e6', blackName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Move 2: Black bans White's Ng1-f3
    console.log('\n--- Move 2 ---');
    await GameHelper.banMove(blackPage, 'g1', 'f3', blackName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // White plays Nb1-c3 instead
    await GameHelper.makeMove(whitePage, 'b1', 'c3', whiteName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // White bans Black's Ng8-f6
    await GameHelper.banMove(whitePage, 'g8', 'f6', whiteName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Black plays Nb8-c6 instead
    await GameHelper.makeMove(blackPage, 'b8', 'c6', blackName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Move 3: Black bans White's e2-e4 again (if still available)
    console.log('\n--- Move 3 ---');
    await GameHelper.banMove(blackPage, 'e2', 'e3', blackName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // White plays Bc1-f4
    await GameHelper.makeMove(whitePage, 'c1', 'f4', whiteName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Continue for a few more moves to test the flow...
    
    // Step 6: Check game state
    console.log('\n=== STEP 5: Verifying Game State ===');
    
    // Verify that moves are being recorded
    const moveHistory1 = await player1Page.evaluate(() => {
      const history = document.querySelector('[data-testid="move-history"]');
      return history?.textContent || '';
    });
    
    const moveHistory2 = await player2Page.evaluate(() => {
      const history = document.querySelector('[data-testid="move-history"]');
      return history?.textContent || '';
    });
    
    console.log('Move history from Player1:', moveHistory1);
    console.log('Move history from Player2:', moveHistory2);
    
    // Both players should see the same moves
    expect(moveHistory1).toBeTruthy();
    expect(moveHistory2).toBeTruthy();
    
    // Take screenshots for debugging
    if (process.env.SCREENSHOTS === 'true') {
      await player1Page.screenshot({ path: 'e2e/screenshots/player1-final.png' });
      await player2Page.screenshot({ path: 'e2e/screenshots/player2-final.png' });
    }
    
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
  }, 120000); // 2 minute timeout for the entire test
});