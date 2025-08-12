/**
 * Test Coordination Protocol for Ban Chess
 * Direct command-based communication between master and sub-agent
 */

// Master Agent Protocol (Player 1 - WHITE)
export const masterProtocol = {

  // Send specific command to sub-agent
  sendCommand: (command, params) => {
    const msg = {
      type: 'COMMAND',
      command: command,
      params: params,
      timestamp: Date.now()
    };
    window.sendMasterMessage(JSON.stringify(msg));
    return `Sent command: ${command}`;
  },

  // Clean session and authenticate
  authenticatePlayer1: async () => {
    // Navigate with clean session
    await mcp__puppeteer__puppeteer_navigate({ url: 'http://localhost:3000?clean=true' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Click Continue as Guest using the working JavaScript method
    const script = `
      const buttons = Array.from(document.querySelectorAll('button'));
      const guestButton = buttons.find(btn => btn.textContent.trim() === 'Continue as Guest');
      if (guestButton) {
        guestButton.click();
        'Clicked Continue as Guest';
      }
    `;
    await mcp__puppeteer__puppeteer_evaluate({ script });
    await new Promise(r => setTimeout(r, 2000));
    
    // Get username and send status
    const getUserScript = `
      const username = document.querySelector('[data-testid="username-display"]')?.textContent || 
                       document.querySelector('.username')?.textContent ||
                       'unknown';
      window.sendMasterMessage('Player 1: Authenticated as ' + username);
      username;
    `;
    return await mcp__puppeteer__puppeteer_evaluate({ script: getUserScript });
  },

  // Queue for game
  queueForGame: async () => {
    const script = `
      const playButton = Array.from(document.querySelectorAll('button'))
        .find(btn => btn.textContent.includes('Play'));
      if (playButton) {
        playButton.click();
        window.sendMasterMessage('Player 1: Queued');
        'Queued';
      }
    `;
    return await mcp__puppeteer__puppeteer_evaluate({ script });
  }
};

// Sub-Agent Protocol (Player 2 - BLACK)
export const subAgentProtocol = {
  // Listen for and execute commands
  listenForCommands: () => {
    const checkInterval = setInterval(async () => {
      const response = await fetch('/master-messages.json');
      const messages = await response.json();
      
      // Find unprocessed commands
      const commands = messages.filter(m => {
        try {
          const parsed = JSON.parse(m.text);
          return parsed.type === 'COMMAND' && !window.processedCommands?.includes(parsed.timestamp);
        } catch {
          return false;
        }
      });

      for (const cmdMsg of commands) {
        const cmd = JSON.parse(cmdMsg.text);
        window.processedCommands = window.processedCommands || [];
        window.processedCommands.push(cmd.timestamp);
        
        // Execute command based on type
        switch (cmd.command) {
          case 'NAVIGATE':
            await mcp__puppeteer__puppeteer_navigate({ url: cmd.params.url });
            window.sendSubMessage(`Player 2: Navigated to ${cmd.params.url}`);
            break;
            
          case 'LOGIN':
            const script = cmd.params.script || `
              const buttons = Array.from(document.querySelectorAll('button'));
              const guestButton = buttons.find(btn => btn.textContent.trim() === 'Continue as Guest');
              if (guestButton) guestButton.click();
            `;
            await mcp__puppeteer__puppeteer_evaluate({ script });
            window.sendSubMessage('Player 2: Logged in as guest');
            break;
            
          case 'QUEUE':
            const queueScript = `
              const playButton = Array.from(document.querySelectorAll('button'))
                .find(btn => btn.textContent.includes('Play'));
              if (playButton) playButton.click();
            `;
            await mcp__puppeteer__puppeteer_evaluate({ script: queueScript });
            window.sendSubMessage('Player 2: Queued');
            break;
            
          case 'BAN':
            await mcp__puppeteer__puppeteer_fill({ 
              selector: '[data-testid="board-test-input"]', 
              value: cmd.params.move 
            });
            await mcp__puppeteer__puppeteer_evaluate({ 
              script: 'document.querySelector("[data-testid=\\"board-test-input\\"]").dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}))' 
            });
            window.sendSubMessage(`Player 2: Banned ${cmd.params.move}`);
            break;
            
          case 'MOVE':
            await mcp__puppeteer__puppeteer_fill({ 
              selector: '[data-testid="board-test-input"]', 
              value: cmd.params.move 
            });
            await mcp__puppeteer__puppeteer_evaluate({ 
              script: 'document.querySelector("[data-testid=\\"board-test-input\\"]").dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}))' 
            });
            window.sendSubMessage(`Player 2: Played ${cmd.params.move}`);
            break;
        }
      }
    }, 1000);
    
    window.commandListener = checkInterval;
    return 'Started command listener';
  }
};

// Coordination helpers
export const coordination = {
  // Wait for both players to be ready
  waitForBothReady: async () => {
    let attempts = 0;
    while (attempts < 30) {
      const masterResp = await fetch('/master-messages.json');
      const subResp = await fetch('/sub-messages.json');
      const masterMsgs = await masterResp.json();
      const subMsgs = await subResp.json();
      
      const masterReady = masterMsgs.some(m => m.text.includes('Authenticated'));
      const subReady = subMsgs.some(m => m.text.includes('Authenticated'));
      
      if (masterReady && subReady) {
        return true;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }
    return false;
  },

  // Check if game has started
  checkGameStarted: async () => {
    const masterResp = await fetch('/master-messages.json');
    const subResp = await fetch('/sub-messages.json');
    const masterMsgs = await masterResp.json();
    const subMsgs = await subResp.json();
    
    return masterMsgs.some(m => m.text.includes('Game started')) ||
           subMsgs.some(m => m.text.includes('Game started'));
  }
};