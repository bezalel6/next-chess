# Coolify Log Fetcher Scripts

Scripts to fetch and debug Coolify deployment logs from your remote server.

## Usage

### Windows (Command Prompt or PowerShell)

```cmd
scripts\fetch-coolify-logs.bat
```

Or with a specific deployment ID:
```cmd
scripts\fetch-coolify-logs.bat ycw4c8wkcss0o844ks8kcskc
```

### Linux/Mac (Bash)

```bash
chmod +x scripts/fetch-coolify-logs.sh
./scripts/fetch-coolify-logs.sh
```

Or with a specific deployment ID:
```bash
./scripts/fetch-coolify-logs.sh ycw4c8wkcss0o844ks8kcskc
```

## What it fetches

The script connects to `rndev@rndev.local` via SSH and collects:

1. **Container Status** - All running and stopped containers
2. **Service Logs** - Last 50 lines from each service:
   - PostgreSQL
   - REST API
   - Auth Service
   - Realtime Service
   - Storage Service
   - Kong Gateway
   - Next.js App
3. **Proxy Logs** - Traefik routing issues
4. **Network Configuration** - Docker network setup
5. **Port Usage** - What's listening on which ports
6. **Resource Usage** - CPU, Memory, Disk usage
7. **System Status** - Overall system health

## Output

Logs are saved to: `logs/coolify_logs_[timestamp].txt`

## Requirements

- SSH access to `rndev@rndev.local`
- Docker installed on remote server
- Appropriate permissions to run docker commands

## Automated Version

For Windows with PuTTY installed:
```cmd
scripts\fetch-coolify-logs-auto.bat
```

This version can use plink (from PuTTY) to avoid password prompts.

## Troubleshooting

If SSH fails:
1. Check you can manually SSH: `ssh rndev@rndev.local`
2. Ensure SSH key is set up or password authentication is enabled
3. Verify the remote user has sudo/docker permissions

If logs are empty:
1. Check if containers are actually running
2. Verify the deployment ID is correct
3. Ensure docker commands work on the remote server