# Coolify Domain Setup Guide for Next Chess

## Prerequisites

- Coolify v4.0+ installed and running
- A domain name you own (e.g., `yourdomain.com`)
- Access to your domain's DNS settings (Cloudflare, Namecheap, etc.)
- Your server's public IP address

## Step 1: DNS Configuration

### Option A: Using Subdomains (Recommended)

Add these DNS records to your domain:

```
Type  Name              Value               TTL     Proxy
A     chess            YOUR_SERVER_IP      3600    No
A     chess-api        YOUR_SERVER_IP      3600    No
```

This will create:
- `chess.yourdomain.com` - Main application
- `chess-api.yourdomain.com` - API Gateway

### Option B: Using Root Domain

```
Type  Name              Value               TTL     Proxy
A     @                YOUR_SERVER_IP      3600    No
A     api              YOUR_SERVER_IP      3600    No
```

This will create:
- `yourdomain.com` - Main application
- `api.yourdomain.com` - API Gateway

### Option C: Using Cloudflare (with proxy)

```
Type  Name              Value               TTL     Proxy
A     chess            YOUR_SERVER_IP      Auto    Yes (orange cloud)
A     chess-api        YOUR_SERVER_IP      Auto    Yes (orange cloud)
```

**Note**: If using Cloudflare proxy, enable "Full SSL" mode in Cloudflare SSL/TLS settings.

## Step 2: Coolify Initial Setup

### 2.1 Access Coolify Dashboard

1. Navigate to your Coolify instance (usually `http://YOUR_SERVER_IP:8000`)
2. Log in with your credentials

### 2.2 Add Your Server (if not already added)

1. Go to "Servers" → "Add Server"
2. Enter server details:
   - Name: `production-server`
   - IP: `localhost` (if Coolify is on same server)
   - User: `root` or your sudo user
   - Port: `22`

## Step 3: Create New Project

1. Click "New Project"
2. Name: `next-chess`
3. Description: `Next Chess with Self-Hosted Supabase`

## Step 4: Add New Resource

1. In your project, click "New Resource"
2. Select "Public Repository"
3. Enter repository URL: `https://github.com/bezalel6/next-chess.git`
4. Branch: `main`

## Step 5: Configure Build Settings

1. **Build Pack**: Docker Compose
2. **Base Directory**: `/`
3. **Docker Compose File**: `docker-compose.coolify.yml`
4. **Dockerfile**: `Dockerfile`

## Step 6: Configure Domains

### 6.1 Main Application Domain

1. In the resource settings, find "Domains"
2. Click "Add Domain"
3. Enter your domain: `chess.yourdomain.com`
4. Enable "Generate SSL Certificate" (Let's Encrypt)
5. Port: `3000`

### 6.2 API Gateway Domain

Since we have multiple services, we need to configure the Kong service:

1. In "Advanced" settings, add custom labels:

```yaml
services:
  kong:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.kong.rule=Host(`chess-api.yourdomain.com`)"
      - "traefik.http.routers.kong.entrypoints=https"
      - "traefik.http.routers.kong.tls=true"
      - "traefik.http.routers.kong.tls.certresolver=letsencrypt"
      - "traefik.http.services.kong.loadbalancer.server.port=8000"
```

## Step 7: Environment Variables

Click on "Environment Variables" and add:

```env
# === REQUIRED: Update these with your actual domains ===
SITE_URL=https://chess.yourdomain.com
API_EXTERNAL_URL=https://chess-api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://chess-api.yourdomain.com

# === SECURITY: Generate new values ===
# Generate with: openssl rand -base64 32
JWT_SECRET=GENERATE_NEW_32_CHAR_SECRET_HERE
POSTGRES_PASSWORD=GENERATE_STRONG_PASSWORD_HERE

# === Supabase Keys (keep these as-is for now) ===
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# === Database ===
POSTGRES_USER=postgres
POSTGRES_DB=next_chess

# === Email (Optional - for production) ===
EMAIL_ENABLED=true
EMAIL_AUTOCONFIRM=true  # Set to false in production
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SENDER_NAME=Next Chess
SMTP_ADMIN_EMAIL=admin@yourdomain.com

# === Application ===
NODE_ENV=production
SKIP_ENV_VALIDATION=true
```

### Generate Secure Values

Run these commands locally to generate secure values:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

## Step 8: Configure Persistent Storage

1. Go to "Storages" in your resource
2. Add these volumes:

```yaml
postgres_data:/var/lib/postgresql/data
storage_data:/var/lib/storage
```

## Step 9: Deploy

1. Click "Deploy"
2. Watch the deployment logs
3. Wait for all services to be healthy (3-5 minutes)

## Step 10: Verify Deployment

### Check DNS Propagation

```bash
# Check if DNS is resolving
nslookup chess.yourdomain.com
ping chess.yourdomain.com
```

### Test Endpoints

1. Main App: `https://chess.yourdomain.com`
2. API Health: `https://chess-api.yourdomain.com/auth/v1/health`
3. REST API: `https://chess-api.yourdomain.com/rest/v1/`

## Step 11: Post-Deployment Configuration

### 11.1 Initialize Admin User (Optional)

SSH into your server and run:

```bash
# Get container name
docker ps | grep next-chess

# Create admin user
docker exec -it [container_name] psql -U postgres -d next_chess -c "
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  crypt('your_password', gen_salt('bf')),
  now(),
  now(),
  now()
);"
```

### 11.2 Configure Email for Production

For production email, update environment variables:

```env
EMAIL_ENABLED=true
EMAIL_AUTOCONFIRM=false
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

## Troubleshooting

### SSL Certificate Issues

If SSL certificates aren't generating:

1. Verify DNS is pointing to correct IP
2. Check Coolify logs: `docker logs coolify`
3. Ensure ports 80 and 443 are open:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```

### Domain Not Accessible

1. Check DNS propagation: https://dnschecker.org
2. Verify Coolify proxy is running:
   ```bash
   docker ps | grep traefik
   ```
3. Check domain configuration in Coolify dashboard

### API Gateway Not Working

1. Verify Kong service is running:
   ```bash
   docker ps | grep kong
   ```
2. Check Kong logs:
   ```bash
   docker logs [kong_container_id]
   ```

### WebSocket/Realtime Issues

1. Ensure WebSocket support in Traefik:
   ```yaml
   labels:
     - "traefik.http.middlewares.sslheader.headers.customrequestheaders.X-Forwarded-Proto=https"
   ```

### Database Connection Issues

1. Check PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```
2. Verify connection:
   ```bash
   docker exec -it [postgres_container] psql -U postgres -d next_chess -c "\l"
   ```

## Security Checklist

- [ ] Changed default JWT_SECRET
- [ ] Set strong POSTGRES_PASSWORD
- [ ] SSL certificates active
- [ ] Email authentication configured
- [ ] Firewall rules configured (ports 22, 80, 443 only)
- [ ] Regular backups configured
- [ ] Monitoring set up

## Monitoring

### Using Coolify's Built-in Monitoring

1. Go to your resource
2. Click "Monitoring" tab
3. View CPU, Memory, Network usage

### Application Logs

1. In Coolify dashboard, click "Logs"
2. Select service to view logs
3. Or SSH and use:
   ```bash
   docker-compose -f docker-compose.coolify.yml logs -f [service_name]
   ```

## Backup Strategy

### Automated Backups with Coolify

1. Go to "Backups" in your resource
2. Configure backup schedule
3. Set backup destination (S3, local, etc.)

### Manual Backup

```bash
# Database backup
docker exec postgres pg_dump -U postgres next_chess > backup_$(date +%Y%m%d).sql

# Volume backup
docker run --rm \
  -v next-chess_postgres_data:/source \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz /source
```

## Updating the Application

1. Push changes to GitHub
2. In Coolify, click "Redeploy"
3. Or enable "Auto Deploy" for automatic updates

## Support Resources

- **Coolify Discord**: https://discord.gg/coolify
- **Coolify Docs**: https://coolify.io/docs
- **Next Chess Issues**: https://github.com/bezalel6/next-chess/issues