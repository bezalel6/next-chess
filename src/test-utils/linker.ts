/**
 * Linker Pattern for Test Selectors
 * 
 * This provides a type-safe way to link test selectors between
 * React components and test code.
 * 
 * Usage in components:
 *   <Button {...Linker.auth.signInAsGuest()} />
 * 
 * Usage in tests:
 *   await page.locator(Linker.auth.signInAsGuest.selector).click()
 */

type TestIdProps = {
  'data-testid': string;
};

type SelectorFunction = {
  (): TestIdProps;
  selector: string;
  testId: string;
};

function createSelector(testId: string): SelectorFunction {
  const fn = (() => ({ 'data-testid': testId })) as SelectorFunction;
  fn.selector = `[data-testid="${testId}"]`;
  fn.testId = testId;
  return fn;
}

export const Linker = {
  // Authentication
  auth: {
    signInAsGuest: createSelector('auth-sign-in-as-guest'),
    usernameInput: createSelector('auth-username-input'),
    continueButton: createSelector('auth-continue-button'),
    loginButton: createSelector('auth-login-button'),
    signupButton: createSelector('auth-signup-button'),
    emailInput: createSelector('auth-email-input'),
    passwordInput: createSelector('auth-password-input'),
    switchToLogin: createSelector('auth-switch-to-login'),
    switchToSignup: createSelector('auth-switch-to-signup'),
  },

  // Queue/Matchmaking
  queue: {
    findGameButton: createSelector('queue-find-game'),
    cancelButton: createSelector('queue-cancel'),
    queueStatus: createSelector('queue-status'),
    playerCount: createSelector('queue-player-count'),
  },

  // Game Board
  game: {
    board: createSelector('game-board'),
    square: (square: string) => createSelector(`game-square-${square}`),
    piece: (square: string) => createSelector(`game-piece-${square}`),
    
    // Ban phase
    banPhaseIndicator: createSelector('game-ban-phase-indicator'),
    banMoveButton: (move: string) => createSelector(`game-ban-move-${move}`),
    confirmBanButton: createSelector('game-confirm-ban'),
    selectedBanMove: createSelector('game-selected-ban-move'),
    
    // Turn indicators
    yourTurnIndicator: createSelector('game-your-turn'),
    opponentTurnIndicator: createSelector('game-opponent-turn'),
    waitingIndicator: createSelector('game-waiting'),
    
    // Game info
    whitePlayer: createSelector('game-white-player'),
    blackPlayer: createSelector('game-black-player'),
    whiteTime: createSelector('game-white-time'),
    blackTime: createSelector('game-black-time'),
    
    // Controls
    flipBoardButton: createSelector('game-flip-board'),
    resignButton: createSelector('game-resign'),
    drawButton: createSelector('game-offer-draw'),
    
    // Move history
    moveHistory: createSelector('game-move-history'),
    moveHistoryItem: (moveNumber: number) => createSelector(`game-move-${moveNumber}`),
    
    // Game over
    gameOverModal: createSelector('game-over-modal'),
    gameOverMessage: createSelector('game-over-message'),
    rematchButton: createSelector('game-rematch'),
    newGameButton: createSelector('game-new-game'),
  },

  // Local game setup
  localGame: {
    modeSelector: createSelector('local-mode-selector'),
    vsComputerOption: createSelector('local-vs-computer'),
    vsFriendOption: createSelector('local-vs-friend'),
    startButton: createSelector('local-start-game'),
    difficultySelector: createSelector('local-difficulty'),
  },

  // Chat
  chat: {
    container: createSelector('chat-container'),
    input: createSelector('chat-input'),
    sendButton: createSelector('chat-send'),
    message: (index: number) => createSelector(`chat-message-${index}`),
  },

  // Navigation
  nav: {
    homeLink: createSelector('nav-home'),
    profileLink: createSelector('nav-profile'),
    settingsLink: createSelector('nav-settings'),
    logoutButton: createSelector('nav-logout'),
  },
} as const;

// Helper functions for tests
export const TestHelpers = {
  /**
   * Get selector string for use in Playwright/Puppeteer
   */
  selector: (selectorFn: SelectorFunction): string => selectorFn.selector,
  
  /**
   * Get test ID without brackets
   */
  testId: (selectorFn: SelectorFunction): string => selectorFn.testId,
  
  /**
   * Build a selector for dynamic elements
   */
  dynamicSelector: (base: string, id: string | number): string => 
    `[data-testid="${base}-${id}"]`,
};

// Type exports for use in tests
export type LinkerType = typeof Linker;
export type SelectorFunctionType = SelectorFunction;