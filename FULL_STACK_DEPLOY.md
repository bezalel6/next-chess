# Full Stack Deployment Guide for Coolify

Now that the basic app is working, let's add all Supabase services back.

## Prerequisites

✅ Basic app is running at chess.rndev.site
✅ DNS configured for chess-api.rndev.site
✅ Nginx proxy configured

## Step-by-Step Deployment

### 1. Update DNS (if not done)

Add A record for API:
- `chess-api` → YOUR_SERVER_IP

### 2. Update Nginx Proxy Manager

Add proxy host for API:
- Domain: `chess-api.rndev.site`
- Forward to: `localhost:8080`
- Enable WebSockets
- SSL Certificate: Request new or use existing

### 3. In Coolify - Create New Deployment

Since the simple version is working, create a NEW deployment for the full stack:

1. **Keep the simple one running** (as backup)
2. **Create New Project**: `chess-full-stack`
3. **Add Resource**:
   - Repository: `https://github.com/bezalel6/next-chess.git`
   - Branch: `main`

### 4. Configuration

1. **Build Settings**:
   - Build Pack: **Docker Compose**
   - Compose File: `docker-compose.coolify-full.yml`

2. **Environment Variables** (copy ALL from .env.coolify-full):
```env
SITE_URL=https://chess.rndev.site
API_EXTERNAL_URL=https://chess-api.rndev.site
NEXT_PUBLIC_SUPABASE_URL=https://chess-api.rndev.site
POSTGRES_USER=postgres
POSTGRES_PASSWORD=xK9mN3pQ7fL2wR8bT5sY1vA6
POSTGRES_DB=next_chess
JWT_SECRET=vK9x2mR7fQ3pL8nW6bT4sY1gH5jA0zE9uC3dI7oM2wN6
# ... copy all from .env.coolify-full
```

3. **Domain Configuration**:
   - For `app` service: `chess.rndev.site`
   - For `kong` service: `chess-api.rndev.site`
   - Leave others empty (internal only)

### 5. Deploy and Monitor

1. Click **Deploy**
2. Watch logs carefully for each service
3. Services should start in this order:
   - postgres (database)
   - rest, auth (core services)
   - realtime, storage (additional services)
   - kong (API gateway)
   - app (Next.js)

### 6. Verify Each Service

Check services are healthy:

```bash
# On your server
docker ps | grep chess-full

# Should see all services running:
# postgres, rest, auth, realtime, storage, kong, app
```

Test endpoints:

```bash
# Test API Gateway
curl https://chess-api.rndev.site/auth/v1/health

# Test REST API
curl https://chess-api.rndev.site/rest/v1/

# Test main app
curl https://chess.rndev.site
```

### 7. If Services Fail to Start

Common issues and fixes:

#### Network Issues
```bash
# Ensure all containers are on coolify network
docker network inspect coolify | grep -A 5 "Containers"
```

#### Port Conflicts
```bash
# Check no ports are conflicting
netstat -tlnp | grep -E "(3000|5432|8000|9999|4000|5000)"
```

#### Database Connection
```bash
# Test postgres is accessible
docker exec -it $(docker ps -q -f name=postgres) pg_isready
```

#### Service Dependencies
If services start too fast and fail:
```bash
# Restart individual services in order
docker restart $(docker ps -q -f name=postgres)
sleep 10
docker restart $(docker ps -q -f name=rest)
docker restart $(docker ps -q -f name=auth)
# etc...
```

### 8. Testing Full Features

Once all services are running:

1. **Test Authentication**:
   - Go to https://chess.rndev.site
   - Try to sign up/login

2. **Test Realtime**:
   - Open two browser windows
   - Create a game in one
   - Join in the other
   - Moves should sync in real-time

3. **Test Storage** (if used):
   - Upload profile picture
   - Should save and display

## Troubleshooting

### Kong Gateway Issues
```bash
# Check Kong logs
docker logs $(docker ps -q -f name=kong) --tail 50

# Verify Kong config is mounted
docker exec $(docker ps -q -f name=kong) cat /var/lib/kong/kong.yml
```

### Auth Service Issues
```bash
# Check Auth logs
docker logs $(docker ps -q -f name=auth) --tail 50

# Common issue: Database schema missing
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d next_chess -c "\dn"
# Should show: public, auth, storage, realtime schemas
```

### Realtime WebSocket Issues
```bash
# Check Realtime logs
docker logs $(docker ps -q -f name=realtime) --tail 50

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://chess-api.rndev.site/realtime/v1/websocket
```

## Rollback if Needed

If the full stack has issues:

1. Stop the full stack deployment in Coolify
2. Keep using the simple deployment
3. Debug issues offline

## Success Indicators

✅ All containers show "Up" status
✅ https://chess.rndev.site loads without errors
✅ https://chess-api.rndev.site/auth/v1/health returns success
✅ Can create account and login
✅ Real-time game updates work
✅ No errors in browser console

## Next Steps

Once everything works:
1. Delete the simple deployment (keep full stack)
2. Configure email for production
3. Set up backups
4. Monitor performance