# Simplified Deployment for Coolify

This is a minimal setup that runs just the chess app with PostgreSQL, without the complex Supabase services.

## What's Included

- ✅ PostgreSQL database
- ✅ Next.js chess application
- ❌ No Supabase Auth (authentication disabled)
- ❌ No Realtime (WebSocket features disabled)
- ❌ No Storage service

## Deployment Steps in Coolify

### 1. Clean Up Previous Attempts

SSH into your server and run:
```bash
# Stop and remove failed containers
docker ps -a | grep -E "(kong|auth|realtime|rest|storage)" | awk '{print $1}' | xargs -r docker stop
docker ps -a | grep -E "(kong|auth|realtime|rest|storage)" | awk '{print $1}' | xargs -r docker rm
```

### 2. In Coolify Dashboard

1. **Delete** the existing complex deployment
2. **Create New Project** → Name: `chess-simple`
3. **Add Resource**:
   - Repository: `https://github.com/bezalel6/next-chess.git`
   - Branch: `main`

### 3. Configuration

1. **Build Settings**:
   - Build Pack: **Docker Compose**
   - Compose File: `docker-compose.coolify-simple.yml`

2. **Environment Variables** (copy all from .env.simple):
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YourSecurePassword123!
POSTGRES_DB=next_chess
NODE_ENV=production
PORT=3000
SKIP_ENV_VALIDATION=true
```

3. **Domain Configuration**:
   - For the `app` service: Enter `chess.rndev.site`
   - Leave PostgreSQL without a domain (internal only)

### 4. Deploy

Click **Deploy** and monitor the logs. This simplified version should start much more reliably.

## Testing

Once deployed, test:
```bash
# Check if services are running
curl https://chess.rndev.site

# Check container status
docker ps | grep chess
```

## Limitations

With this simplified setup:
- No user authentication (single-player only)
- No real-time game updates
- No game persistence between sessions
- Basic functionality only

## Next Steps

Once this simple version is working:
1. Verify the app loads at https://chess.rndev.site
2. Test basic chess moves
3. Check PostgreSQL connectivity
4. Then we can gradually add back Supabase services

## Troubleshooting

### If app won't start:
```bash
# Check app logs
docker logs $(docker ps -q -f name=app) --tail 50

# Check database
docker logs $(docker ps -q -f name=postgres) --tail 50
```

### If "Supabase required" errors:
The app expects Supabase but we're providing dummy values. The app may show errors but should still load.

### Network issues:
```bash
# Verify coolify network exists
docker network ls | grep coolify

# Check if containers are on the network
docker network inspect coolify
```

## Alternative: Local Testing First

Before deploying to Coolify, test locally:
```bash
# On your server
cd /tmp
git clone https://github.com/bezalel6/next-chess.git
cd next-chess
docker-compose -f docker-compose.simple.yml up

# If it works locally, then deploy to Coolify
```