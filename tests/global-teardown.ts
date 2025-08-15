/**
 * Global teardown for Playwright tests
 * Ensures complete cleanup after all tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, unlinkSync } from 'fs';

const execAsync = promisify(exec);

async function globalTeardown() {
  console.log('🧹 Running global teardown...');
  
  // Wait a moment for processes to close gracefully
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Force kill any remaining browser processes
  console.log('Killing any remaining browser processes...');
  
  const killCommands = process.platform === 'win32' ? [
    // Windows commands
    'taskkill /F /IM chrome.exe /T 2>nul',
    'taskkill /F /IM firefox.exe /T 2>nul',
    'taskkill /F /IM msedge.exe /T 2>nul',
    'taskkill /F /IM chromium.exe /T 2>nul',
    'wmic process where "name like \'%chrome%\'" delete 2>nul',
    'wmic process where "name like \'%firefox%\'" delete 2>nul',
    // Kill any node processes that might be playwright-related
    'for /f "tokens=2" %i in (\'tasklist ^| findstr /i "node.exe"\') do taskkill /PID %i /F 2>nul',
  ] : [
    // Unix/Linux/Mac commands
    'pkill -9 -f chromium || true',
    'pkill -9 -f firefox || true',
    'pkill -9 -f chrome || true',
    'pkill -9 -f webkit || true',
    'pkill -9 -f playwright || true',
    // Kill any orphaned browser processes
    'ps aux | grep -E "(chrome|firefox|chromium)" | grep -v grep | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true',
  ];
  
  for (const cmd of killCommands) {
    try {
      await execAsync(cmd);
    } catch {
      // Continue with cleanup
    }
  }
  
  // Clean up temp files and directories
  console.log('Cleaning up temp files...');
  
  const cleanupCommands = process.platform === 'win32' ? [
    'del /Q /F %TEMP%\\playwright* 2>nul',
    'rmdir /S /Q %TEMP%\\playwright* 2>nul',
    'del /Q /F %TEMP%\\pw-* 2>nul',
    'rmdir /S /Q %TEMP%\\pw-* 2>nul',
    // Clean Chrome temp profiles
    'rmdir /S /Q "%LOCALAPPDATA%\\Temp\\playwright*" 2>nul',
    'rmdir /S /Q "%LOCALAPPDATA%\\Temp\\puppeteer*" 2>nul',
  ] : [
    'rm -rf /tmp/playwright* 2>/dev/null || true',
    'rm -rf /tmp/pw-* 2>/dev/null || true',
    'rm -rf /tmp/.org.chromium.* 2>/dev/null || true',
    'rm -rf /tmp/puppeteer* 2>/dev/null || true',
    // Clean Chrome crash dumps
    'rm -rf ~/.config/chromium/Crash\\ Reports/* 2>/dev/null || true',
  ];
  
  for (const cmd of cleanupCommands) {
    try {
      await execAsync(cmd);
    } catch {
      // Continue with cleanup
    }
  }
  
  // Clean up PID tracking file
  if (existsSync('.test-pids')) {
    try {
      unlinkSync('.test-pids');
    } catch {
      // Ignore
    }
  }
  
  // Verify cleanup
  await verifyCleanup();
  
  console.log('✅ Global teardown complete');
}

async function verifyCleanup() {
  console.log('Verifying cleanup...');
  
  const checkCommands = process.platform === 'win32' ? [
    'tasklist | findstr /i "chrome firefox chromium"',
  ] : [
    'ps aux | grep -E "(chrome|firefox|chromium)" | grep -v grep',
  ];
  
  for (const cmd of checkCommands) {
    try {
      const { stdout } = await execAsync(cmd);
      if (stdout && stdout.trim()) {
        console.warn('⚠️ Found remaining browser processes:', stdout);
        
        // Try one more aggressive cleanup
        if (process.platform === 'win32') {
          await execAsync('taskkill /F /IM chrome.exe /T');
          await execAsync('taskkill /F /IM firefox.exe /T');
        } else {
          await execAsync('pkill -9 -f "(chrome|firefox|chromium)"');
        }
      }
    } catch {
      // No processes found, which is good
    }
  }
  
  // Check for zombie processes
  if (process.platform !== 'win32') {
    try {
      const { stdout } = await execAsync('ps aux | grep defunct | grep -v grep');
      if (stdout && stdout.trim()) {
        console.warn('⚠️ Found zombie processes:', stdout);
      }
    } catch {
      // No zombies found
    }
  }
}

// Ensure cleanup runs even on unexpected exit
process.on('exit', () => {
  console.log('Process exiting, ensuring cleanup...');
  
  // Synchronous cleanup as last resort
  if (process.platform === 'win32') {
    try {
      require('child_process').execSync('taskkill /F /IM chrome.exe /T 2>nul');
      require('child_process').execSync('taskkill /F /IM firefox.exe /T 2>nul');
    } catch {
      // Ignore
    }
  } else {
    try {
      require('child_process').execSync('pkill -9 -f chromium 2>/dev/null || true');
      require('child_process').execSync('pkill -9 -f firefox 2>/dev/null || true');
    } catch {
      // Ignore
    }
  }
});

export default globalTeardown;