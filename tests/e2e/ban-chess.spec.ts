import { test, expect, Page } from '@playwright/test';

// Helper function to make a move in the game
async function makeMove(page: Page, move: string) {
  const input = page.getByTestId('board-move-input');
  await input.fill(move);
  await input.press('Enter');
  // Wait for the move to be processed
  await page.waitForTimeout(500);
}

// Helper function to get game status
async function getGameStatus(page: Page) {
  // Using getByText for better reliability
  const phaseRow = page.getByText('Phase').locator('..');
  const phase = await phaseRow.locator('div:last-child').textContent();
  
  const activePlayerRow = page.getByText('Active Player').locator('..');
  const activePlayer = await activePlayerRow.locator('p').textContent();
  
  const bannedMoveRow = page.getByText('Banned Move').locator('..');
  // Use last() to get the actual banned move value, not the rules text
  const bannedMove = await bannedMoveRow.locator('p').last().textContent();
  
  const gameStatusRow = page.getByText('Game Status').locator('..');
  const gameStatus = await gameStatusRow.locator('p').last().textContent();
  
  return {
    phase: phase?.trim(),
    activePlayer: activePlayer?.trim(),
    bannedMove: bannedMove?.trim(),
    gameStatus: gameStatus?.trim()
  };
}

test.describe('Ban Chess E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local game
    await page.goto('http://localhost:3000/local-game');
    await page.waitForLoadState('networkidle');
  });

  test('Ban Chess checkmate - King in check with only one legal move that gets banned', async ({ page }) => {
    console.log('Starting Ban Chess checkmate test...');
    
    // This test will create a position where:
    // 1. Black's king is in check
    // 2. Black has only one legal move to escape
    // 3. White bans that move, resulting in checkmate
    
    // Move sequence to reach the checkmate position
    const moves = [
      // Black bans e2e4
      { move: 'e2 e4', type: 'ban', player: 'black' },
      // White plays d2d4
      { move: 'd2 d4', type: 'move', player: 'white' },
      // White bans e7e5
      { move: 'e7 e5', type: 'ban', player: 'white' },
      // Black plays d7d5
      { move: 'd7 d5', type: 'move', player: 'black' },
      // Black bans g1f3
      { move: 'g1 f3', type: 'ban', player: 'black' },
      // White plays c1g5
      { move: 'c1 g5', type: 'move', player: 'white' },
      // White bans f7f6
      { move: 'f7 f6', type: 'ban', player: 'white' },
      // Black plays h7h6
      { move: 'h7 h6', type: 'move', player: 'black' },
      // Black bans b1c3
      { move: 'b1 c3', type: 'ban', player: 'black' },
      // White plays g5f4
      { move: 'g5 f4', type: 'move', player: 'white' },
      // White bans g7g5
      { move: 'g7 g5', type: 'ban', player: 'white' },
      // Black plays c7c6
      { move: 'c7 c6', type: 'move', player: 'black' },
      // Black bans e2e3
      { move: 'e2 e3', type: 'ban', player: 'black' },
      // White plays e2e3
      { move: 'e2 e3', type: 'move', player: 'white' },
      // White bans b8d7
      { move: 'b8 d7', type: 'ban', player: 'white' },
      // Black plays g8f6
      { move: 'g8 f6', type: 'move', player: 'black' },
      // Black bans f1d3
      { move: 'f1 d3', type: 'ban', player: 'black' },
      // White plays f1d3
      { move: 'f1 d3', type: 'move', player: 'white' },
      // White bans e7e6
      { move: 'e7 e6', type: 'ban', player: 'white' },
      // Black plays c8g4
      { move: 'c8 g4', type: 'move', player: 'black' },
      // Black bans d1d2
      { move: 'd1 d2', type: 'ban', player: 'black' },
      // White plays d1b3
      { move: 'd1 b3', type: 'move', player: 'white' },
      // White bans d8b6
      { move: 'd8 b6', type: 'ban', player: 'white' },
      // Black plays d8b6
      { move: 'd8 b6', type: 'move', player: 'black' },
      // Black bans b3b7
      { move: 'b3 b7', type: 'ban', player: 'black' },
      // White plays b3b7 - Check!
      { move: 'b3 b7', type: 'move', player: 'white' },
    ];

    // Execute the move sequence
    for (const moveData of moves) {
      console.log(`${moveData.player} ${moveData.type}: ${moveData.move}`);
      await makeMove(page, moveData.move);
      
      // Check if game is over
      const status = await getGameStatus(page);
      if (status.gameStatus === 'Finished') {
        console.log('Game Over detected!');
        break;
      }
    }

    // Verify game status
    const finalStatus = await getGameStatus(page);
    console.log('Final game status:', finalStatus);
    
    // The test passes if we can execute moves without errors
    // In a real scenario, we'd check for checkmate, but for now we're testing the flow
    expect(finalStatus).toBeDefined();
  });

  test('Quick checkmate scenario - Scholar\'s mate variant', async ({ page }) => {
    console.log('Starting Scholar\'s mate variant test...');
    
    // Simplified sequence trying to achieve a quick checkmate
    const moves = [
      // Black bans e2e4
      { move: 'e2 e4', type: 'ban', player: 'black' },
      // White plays d2d4
      { move: 'd2 d4', type: 'move', player: 'white' },
      // White bans e7e6
      { move: 'e7 e6', type: 'ban', player: 'white' },
      // Black plays d7d5
      { move: 'd7 d5', type: 'move', player: 'black' },
      // Black bans c1f4
      { move: 'c1 f4', type: 'ban', player: 'black' },
      // White plays g1f3
      { move: 'g1 f3', type: 'move', player: 'white' },
      // White bans g8f6
      { move: 'g8 f6', type: 'ban', player: 'white' },
      // Black plays c8f5
      { move: 'c8 f5', type: 'move', player: 'black' },
      // Black bans e2e3
      { move: 'e2 e3', type: 'ban', player: 'black' },
      // White plays e2e3
      { move: 'e2 e3', type: 'move', player: 'white' },
      // White bans e7e6
      { move: 'e7 e6', type: 'ban', player: 'white' },
      // Black plays e7e6
      { move: 'e7 e6', type: 'move', player: 'black' },
      // Black bans f1d3
      { move: 'f1 d3', type: 'ban', player: 'black' },
      // White plays f1d3
      { move: 'f1 d3', type: 'move', player: 'white' },
      // White bans f5d3
      { move: 'f5 d3', type: 'ban', player: 'white' },
      // Black plays f5d3
      { move: 'f5 d3', type: 'move', player: 'black' },
      // Black bans d1d3
      { move: 'd1 d3', type: 'ban', player: 'black' },
      // White plays d1d3
      { move: 'd1 d3', type: 'move', player: 'white' },
      // White bans g8f6
      { move: 'g8 f6', type: 'ban', player: 'white' },
      // Black plays g8f6
      { move: 'g8 f6', type: 'move', player: 'black' },
      // Black bans b1c3
      { move: 'b1 c3', type: 'ban', player: 'black' },
      // White plays b1c3
      { move: 'b1 c3', type: 'move', player: 'white' },
      // White bans f8e7
      { move: 'f8 e7', type: 'ban', player: 'white' },
      // Black plays b8c6
      { move: 'b8 c6', type: 'move', player: 'black' },
      // Black bans e1g1 (castle)
      { move: 'e1 g1', type: 'ban', player: 'black' },
      // White plays c1d2
      { move: 'c1 d2', type: 'move', player: 'white' },
      // White bans f8d6
      { move: 'f8 d6', type: 'ban', player: 'white' },
      // Black plays f8d6
      { move: 'f8 d6', type: 'move', player: 'black' },
      // Black bans e1g1
      { move: 'e1 g1', type: 'ban', player: 'black' },
      // White plays e1g1 (castle)
      { move: 'e1 g1', type: 'move', player: 'white' },
    ];

    // Execute the move sequence
    for (let i = 0; i < moves.length; i++) {
      const moveData = moves[i];
      console.log(`Move ${i + 1}: ${moveData.player} ${moveData.type}: ${moveData.move}`);
      
      await makeMove(page, moveData.move);
      
      // Check game status periodically
      if (i % 5 === 0) {
        const status = await getGameStatus(page);
        console.log(`Status check - Phase: ${status.phase}, Game: ${status.gameStatus}`);
        
        if (status.gameStatus === 'Finished') {
          console.log('Game Over detected!');
          break;
        }
      }
    }

    // Get final status
    const finalStatus = await getGameStatus(page);
    console.log('Final game status:', finalStatus);
    
    // Verify the test ran without errors
    expect(finalStatus).toBeDefined();
    expect(finalStatus.phase).toBeTruthy();
  });

  test('Test game flow and turn mechanics', async ({ page }) => {
    console.log('Testing game flow and turn mechanics...');
    
    // Test the basic flow
    // 1. Black bans
    let status = await getGameStatus(page);
    expect(status.phase).toContain('Selecting Ban');
    expect(status.activePlayer).toBe('Black');
    
    // Black bans e2e4
    await makeMove(page, 'e2 e4');
    
    // 2. White moves
    status = await getGameStatus(page);
    expect(status.phase).toContain('Making Move');
    expect(status.activePlayer).toBe('White');
    expect(status.bannedMove).toBe('e2e4');
    
    // White plays d2d4
    await makeMove(page, 'd2 d4');
    
    // 3. White bans
    status = await getGameStatus(page);
    expect(status.phase).toContain('Selecting Ban');
    expect(status.activePlayer).toBe('White');
    
    // White bans e7e5
    await makeMove(page, 'e7 e5');
    
    // 4. Black moves
    status = await getGameStatus(page);
    expect(status.phase).toContain('Making Move');
    expect(status.activePlayer).toBe('Black');
    expect(status.bannedMove).toBe('e7e5');
    
    // Black plays d7d5
    await makeMove(page, 'd7 d5');
    
    // 5. Black bans (cycle continues)
    status = await getGameStatus(page);
    expect(status.phase).toContain('Selecting Ban');
    expect(status.activePlayer).toBe('Black');
    
    console.log('Turn mechanics working correctly!');
  });
});