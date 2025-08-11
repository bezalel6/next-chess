export const TEST_CONFIG = {
  // Base URL for the app
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  
  // Test user credentials
  testUsers: {
    player1: {
      email: 'test_player1@banchess.test',
      password: 'TestPlayer1!2024',
      username: 'TestPlayer1',
    },
    player2: {
      email: 'test_player2@banchess.test',
      password: 'TestPlayer2!2024',
      username: 'TestPlayer2',
    },
  },
  
  // Puppeteer options
  puppeteer: {
    headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see the browser
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0, // Slow down actions for debugging
    devtools: process.env.DEVTOOLS === 'true',
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
    ],
  },
  
  // Test timeouts
  timeouts: {
    navigation: 30000,
    action: 5000,
    polling: 100,
  },
  
  // Selectors for common elements
  selectors: {
    // Auth
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    loginButton: 'button:has-text("Sign in")',
    signupButton: 'button:has-text("Sign up")',
    
    // Game
    board: '.cg-wrap',
    piece: 'piece',
    moveHistory: '[data-testid="move-history"]',
    banOverlay: '[data-testid="ban-overlay"]',
    gameStatus: '[data-testid="game-status"]',
    
    // Queue
    joinQueueButton: 'button:has-text("Join Queue")',
    leaveQueueButton: 'button:has-text("Leave Queue")',
    queueStatus: '[data-testid="queue-status"]',
  },
};