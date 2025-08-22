# Development Server Zombie Process Issue

**Date:** 2025-08-22  
**Issue:** Port 3000 remains occupied by zombie processes after killing the dev server

## Problem Description

After killing the development server, port 3000 would remain occupied by a "broken" server that couldn't serve requests properly. This was a persistent issue that would occur repeatedly.

## Root Cause Analysis

### The Process Chain
When running development commands (especially `dev:ultra` with nodemon), a chain of processes is created:

1. **npm** → spawns cross-env
2. **cross-env** → sets environment variables and spawns nodemon
3. **nodemon** → watches for file changes and spawns tsx
4. **tsx** → TypeScript executor that spawns the actual Node.js process
5. **node** → runs server.ts which creates the HTTP server on port 3000

### The Problem
The original `kill-running` script used `portio --mine 3000` which only kills the process directly listening on port 3000 (the final node process). However:

1. **Nodemon remains alive**: The nodemon watcher process (and its parents) continue running
2. **Auto-restart behavior**: Nodemon detects that its child process died and immediately restarts it
3. **Race condition**: When starting a new dev server, the kill happens, but nodemon restarts the old server before the new one can bind to port 3000
4. **Zombie state**: The restarted server may be in a broken state due to interrupted initialization

### Evidence Found
- Multiple long-running node processes from hours/days ago
- Process tree showing nodemon → tsx → node chains
- Processes started at 1:40 PM still running at 4:56 PM
- Over 25 node.exe processes accumulated over time

## Solutions Implemented

### Solution 1: Comprehensive Cleanup Script (Backup)
Created a comprehensive process cleanup script (`scripts/kill-dev-processes.js`) that:

1. **Kills processes on port 3000** - The immediate blocker
2. **Kills all nodemon processes** - Prevents auto-restart
3. **Kills all tsx processes running server.ts** - Cleans up TypeScript runners
4. **Kills all cross-env processes with NEXT_ variables** - Cleans up environment setters
5. **Waits for termination** - Ensures processes are fully dead before returning

### Implementation Details

The script uses platform-specific commands:
- **Windows**: Uses `wmic`, `netstat`, and `taskkill`
- **Unix/Linux/Mac**: Uses `lsof`, `ps`, and `kill`

It searches for processes by:
- Port binding (3000)
- Command line patterns (nodemon, tsx, cross-env)
- Specific file references (server.ts)

### Solution 2: Improved Server Shutdown (Primary Fix)
Updated `src/server/server.ts` with robust shutdown handling:

1. **Graceful shutdown sequence**:
   - Stop accepting new connections
   - Clean up Supabase realtime channels
   - Close Next.js app properly
   - Kill child processes on Windows
   - Force exit after timeout

2. **Signal handling improvements**:
   - Handle all termination signals (SIGTERM, SIGINT, SIGHUP, SIGBREAK)
   - Prevent multiple simultaneous shutdowns
   - Handle parent process disconnection
   - Windows-specific signal handling

3. **Child process cleanup**:
   - Uses `wmic` to delete child processes on Windows
   - Closes all server connections immediately
   - Hard timeout of 3 seconds to prevent hanging

### Solution 3: Process Wrapper Script (Optional Enhanced Safety)
Created `scripts/dev-server-wrapper.js` for extra process management:

- Wraps the tsx server execution
- Ensures proper signal forwarding
- Kills entire process tree on Windows
- Available via `npm run dev:safe` commands

## Prevention Strategies

1. **Always use the new kill script**: The updated `npm run kill-running` now uses the comprehensive cleanup
2. **Avoid long-running watchers**: Be cautious with `dev:ultra` and similar commands that use nodemon
3. **Clean shutdown**: Always use Ctrl+C to properly shutdown dev servers when possible
4. **Regular cleanup**: If experiencing issues, run `npm run kill-running` to clean up zombie processes

## Testing

After implementing the fix:
1. Started a dev server with nodemon
2. Killed it improperly (simulating the issue)
3. Ran the new kill script
4. Successfully cleaned up all related processes
5. Port 3000 was properly freed

## Commands Reference

```bash
# New comprehensive cleanup (recommended)
npm run kill-running

# Old simple port kill (kept as kill-running-old)
npm run kill-running-old

# Check what's on port 3000 (Windows)
netstat -ano | findstr :3000 | findstr LISTENING

# Check all node processes (Windows)
powershell "Get-Process node | Select-Object Id, ProcessName, StartTime"

# Manual cleanup of specific PID (Windows)
taskkill /F /PID <process_id>
```

## Long-term Recommendations

1. Consider removing or modifying the `dev:ultra` command to avoid nodemon chains
2. Implement proper process group handling in server.ts
3. Add periodic cleanup to development scripts
4. Consider using PM2 or similar process managers for development that handle cleanup better