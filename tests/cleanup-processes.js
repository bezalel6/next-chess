#!/usr/bin/env node

/**
 * Manual cleanup utility for stuck browser processes
 * Run with: node tests/cleanup-processes.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function cleanup() {
  console.log('🧹 Cleaning up browser processes...\n');
  
  const isWindows = process.platform === 'win32';
  let killedCount = 0;
  
  // List of processes to kill
  const processNames = [
    'chrome',
    'chromium',
    'firefox',
    'msedge',
    'webkit',
    'Google Chrome',
    'Microsoft Edge',
  ];
  
  if (isWindows) {
    // Windows cleanup
    console.log('Platform: Windows');
    console.log('Looking for browser processes...\n');
    
    for (const processName of processNames) {
      try {
        // First, check if process exists
        const checkCmd = `tasklist /FI "IMAGENAME eq ${processName}.exe" 2>nul | findstr /I "${processName}"`;
        const { stdout: checkOutput } = await execAsync(checkCmd);
        
        if (checkOutput && checkOutput.trim()) {
          console.log(`Found ${processName} processes`);
          
          // Kill the process
          const killCmd = `taskkill /F /IM ${processName}.exe /T 2>nul`;
          await execAsync(killCmd);
          console.log(`✅ Killed ${processName} processes`);
          killedCount++;
        }
      } catch (e) {
        // Process doesn't exist or already killed
      }
    }
    
    // Clean up Chrome user data directories
    try {
      await execAsync('rmdir /S /Q "%TEMP%\\scoped_dir*" 2>nul');
      console.log('✅ Cleaned Chrome temp directories');
    } catch {
      // Ignore if doesn't exist
    }
    
  } else {
    // Unix/Linux/Mac cleanup
    console.log('Platform: Unix/Linux/Mac');
    console.log('Looking for browser processes...\n');
    
    for (const processName of processNames) {
      try {
        // Check if process exists
        const checkCmd = `pgrep -f "${processName}"`;
        const { stdout: pids } = await execAsync(checkCmd);
        
        if (pids && pids.trim()) {
          const pidList = pids.trim().split('\n');
          console.log(`Found ${pidList.length} ${processName} process(es)`);
          
          // Kill the processes
          const killCmd = `pkill -9 -f "${processName}"`;
          await execAsync(killCmd);
          console.log(`✅ Killed ${processName} processes`);
          killedCount++;
        }
      } catch {
        // Process doesn't exist
      }
    }
    
    // Clean up temp directories
    try {
      await execAsync('rm -rf /tmp/playwright* 2>/dev/null || true');
      await execAsync('rm -rf /tmp/pw-* 2>/dev/null || true');
      await execAsync('rm -rf /tmp/.org.chromium.* 2>/dev/null || true');
      console.log('✅ Cleaned temp directories');
    } catch {
      // Ignore
    }
    
    // Check for zombie processes
    try {
      const { stdout } = await execAsync('ps aux | grep defunct | grep -v grep');
      if (stdout && stdout.trim()) {
        console.log('\n⚠️ Found zombie processes (these need parent process cleanup):');
        console.log(stdout);
      }
    } catch {
      // No zombies
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (killedCount > 0) {
    console.log(`✅ Cleanup complete! Killed ${killedCount} browser process group(s)`);
  } else {
    console.log('✅ No browser processes found - system is clean!');
  }
  
  // Verify cleanup
  console.log('\nVerifying cleanup...');
  
  if (isWindows) {
    try {
      const { stdout } = await execAsync('tasklist | findstr /I "chrome firefox edge chromium"');
      if (stdout && stdout.trim()) {
        console.log('⚠️ Some processes may still be running:');
        console.log(stdout);
        console.log('\nTry running this script again or restart your computer.');
      } else {
        console.log('✅ All browser processes successfully terminated');
      }
    } catch {
      console.log('✅ All browser processes successfully terminated');
    }
  } else {
    try {
      const { stdout } = await execAsync('ps aux | grep -E "(chrome|firefox|chromium|webkit)" | grep -v grep');
      if (stdout && stdout.trim()) {
        console.log('⚠️ Some processes may still be running:');
        console.log(stdout);
        console.log('\nTry running: sudo killall -9 chrome firefox chromium');
      } else {
        console.log('✅ All browser processes successfully terminated');
      }
    } catch {
      console.log('✅ All browser processes successfully terminated');
    }
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Error during cleanup:', error);
  process.exit(1);
});

// Run cleanup
cleanup().catch(console.error);