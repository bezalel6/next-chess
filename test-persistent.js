import puppeteer from 'puppeteer';
import readline from 'readline';

// Global variables to hold browser instances
let browser1 = null;
let browser2 = null;
let page1 = null;
let page2 = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupBrowsers() {
  console.log('Setting up browsers...');
  
  // Launch first browser (normal mode)
  browser1 = await puppeteer.launch({
    headless: false,
    args: ['--window-size=900,800', '--window-position=0,0'],
    devtools: true
  });
  
  // Launch second browser (incognito mode for separate session)
  browser2 = await puppeteer.launch({
    headless: false,
    args: ['--window-size=900,800', '--window-position=920,0', '--incognito'],
    devtools: true
  });
  
  // Create pages
  page1 = await browser1.newPage();
  page2 = await browser2.newPage();
  
  // Set viewport
  await page1.setViewport({ width: 800, height: 700 });
  await page2.setViewport({ width: 800, height: 700 });
  
  console.log('Browsers ready!');
  return { page1, page2 };
}

async function navigateToGame() {
  if (!page1 || !page2) {
    console.log('Browsers not set up. Run "setup" first.');
    return;
  }
  
  // Get current URLs
  const url1 = page1.url();
  const url2 = page2.url();
  
  // If already on game pages, just reload
  if (url1.includes('/game/') && url2.includes('/game/')) {
    console.log('Reloading game pages...');
    await Promise.all([
      page1.reload({ waitUntil: 'networkidle0' }),
      page2.reload({ waitUntil: 'networkidle0' })
    ]);
    console.log('Pages reloaded!');
  } else {
    console.log('Not on game pages. Use "start" to begin a new game.');
  }
}

async function startNewGame() {
  if (!page1 || !page2) {
    console.log('Browsers not set up. Run "setup" first.');
    return;
  }
  
  console.log('Starting new game...');
  
  // Navigate both to the app
  await Promise.all([
    page1.goto('http://localhost:3000', { waitUntil: 'networkidle0' }),
    page2.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
  ]);
  
  // Sign in as guests
  console.log('Signing in as guests...');
  
  // Player 1
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const guestButton = buttons.find(btn => btn.textContent?.includes('Guest'));
    if (guestButton) guestButton.click();
  });
  
  await page1.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn => btn.textContent?.includes('Play Now'));
  }, { timeout: 10000 });
  
  console.log('Player 1 logged in');
  
  // Player 2
  await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const guestButton = buttons.find(btn => btn.textContent?.includes('Guest'));
    if (guestButton) guestButton.click();
  });
  
  await page2.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn => btn.textContent?.includes('Play Now'));
  }, { timeout: 10000 });
  
  console.log('Player 2 logged in');
  
  // Join queue
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const playButton = buttons.find(btn => btn.textContent?.includes('Play Now'));
    if (playButton) playButton.click();
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const playButton = buttons.find(btn => btn.textContent?.includes('Play Now'));
    if (playButton) playButton.click();
  });
  
  // Wait for game to start
  await Promise.all([
    page1.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page2.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {})
  ]);
  
  console.log('Game started!');
  console.log('Player 1:', page1.url());
  console.log('Player 2:', page2.url());
}

async function takeScreenshots() {
  if (!page1 || !page2) {
    console.log('Browsers not set up. Run "setup" first.');
    return;
  }
  
  const timestamp = Date.now();
  const path1 = `screenshot-player1-${timestamp}.png`;
  const path2 = `screenshot-player2-${timestamp}.png`;
  
  await page1.screenshot({ path: path1, fullPage: false });
  await page2.screenshot({ path: path2, fullPage: false });
  
  console.log(`Screenshots saved: ${path1}, ${path2}`);
}

async function showHelp() {
  console.log(`
Available commands:
  setup    - Set up the browser windows
  start    - Start a new game (sign in and join queue)
  reload   - Reload current pages (useful after HMR changes)
  shot     - Take screenshots of both windows
  eval1 <code> - Run JavaScript in player 1's window
  eval2 <code> - Run JavaScript in player 2's window
  help     - Show this help
  exit     - Close browsers and exit
  `);
}

async function handleCommand(command) {
  const [cmd, ...args] = command.trim().split(' ');
  
  switch(cmd) {
    case 'setup':
      await setupBrowsers();
      break;
    
    case 'start':
      await startNewGame();
      break;
    
    case 'reload':
      await navigateToGame();
      break;
    
    case 'shot':
      await takeScreenshots();
      break;
    
    case 'eval1':
      if (page1 && args.length > 0) {
        try {
          const result = await page1.evaluate(args.join(' '));
          console.log('Result:', result);
        } catch (error) {
          console.error('Error:', error.message);
        }
      } else {
        console.log('Usage: eval1 <JavaScript code>');
      }
      break;
    
    case 'eval2':
      if (page2 && args.length > 0) {
        try {
          const result = await page2.evaluate(args.join(' '));
          console.log('Result:', result);
        } catch (error) {
          console.error('Error:', error.message);
        }
      } else {
        console.log('Usage: eval2 <JavaScript code>');
      }
      break;
    
    case 'help':
      await showHelp();
      break;
    
    case 'exit':
      if (browser1) await browser1.close();
      if (browser2) await browser2.close();
      process.exit(0);
      break;
    
    default:
      console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
  }
}

// Main loop
async function main() {
  console.log('🎮 Persistent Puppeteer Test Session');
  console.log('Type "help" for available commands.');
  console.log('Type "setup" to initialize browsers.\n');
  
  const prompt = () => {
    rl.question('> ', async (command) => {
      if (command.trim()) {
        await handleCommand(command);
      }
      prompt();
    });
  };
  
  prompt();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nClosing browsers...');
  if (browser1) await browser1.close();
  if (browser2) await browser2.close();
  process.exit(0);
});

main();