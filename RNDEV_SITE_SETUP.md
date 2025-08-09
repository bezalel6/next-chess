# Setup Guide for rndev.site

## Your URLs
- **Main Chess App**: https://chess.rndev.site
- **API Gateway**: https://chess-api.rndev.site

## Step 1: DNS Configuration

Add these DNS records to your domain provider (where you manage rndev.site):

| Type | Name | Value | TTL | 
|------|------|-------|-----|
| A | chess | YOUR_SERVER_IP | 3600 |
| A | chess-api | YOUR_SERVER_IP | 3600 |

### If using Cloudflare:
1. Go to your Cloudflare dashboard
2. Select `rndev.site`
3. Go to DNS section
4. Add the records above
5. **Initially**: Keep proxy (orange cloud) OFF for testing
6. **After verified working**: Enable proxy for DDoS protection

### If using other providers (Namecheap, GoDaddy, etc.):
Just add the A records as shown above.

## Step 2: Coolify Setup

### 2.1 Create New Project
1. Log into Coolify
2. Click "New Project"
3. Name: `next-chess`

### 2.2 Add Resource
1. Click "New Resource"
2. Select "Public Repository"
3. Repository: `https://github.com/bezalel6/next-chess.git`
4. Branch: `main`

### 2.3 Configure Build
1. Build Pack: **Docker Compose**
2. Docker Compose File: `docker-compose.coolify.yml`
3. Base Directory: `/`

### 2.4 Set Domains
1. **Main Domain**: `chess.rndev.site`
2. Enable "Generate SSL Certificate"
3. Port: `3000`

### 2.5 Advanced Configuration
Add these labels for the API gateway:

```yaml
services:
  kong:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.kong.rule=Host(`chess-api.rndev.site`)"
      - "traefik.http.routers.kong.entrypoints=https"
      - "traefik.http.routers.kong.tls=true"
      - "traefik.http.routers.kong.tls.certresolver=letsencrypt"
      - "traefik.http.services.kong.loadbalancer.server.port=8000"
```

### 2.6 Environment Variables
Copy ALL contents from `.env.production` file to Coolify's environment variables section.

**IMPORTANT**: The file already has secure passwords generated for you!

## Step 3: Deploy

1. Click "Deploy"
2. Wait 3-5 minutes for all services to start
3. Monitor logs for any errors

## Step 4: Verify

### Check DNS (may take up to 48 hours to propagate):
```bash
nslookup chess.rndev.site
nslookup chess-api.rndev.site
```

### Test endpoints once DNS is ready:
1. Main App: https://chess.rndev.site
2. API Health: https://chess-api.rndev.site/auth/v1/health

## Step 5: Production Email (Optional)

If you want real email functionality, update these in Coolify:

### SendGrid Example:
```env
EMAIL_ENABLED=true
EMAIL_AUTOCONFIRM=false
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_ADMIN_EMAIL=admin@rndev.site
```

### Gmail Example:
```env
EMAIL_ENABLED=true
EMAIL_AUTOCONFIRM=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_ADMIN_EMAIL=admin@rndev.site
```

## Quick Troubleshooting

### If site not accessible:
1. Check DNS propagation: https://dnschecker.org/#A/chess.rndev.site
2. Verify server firewall allows ports 80, 443
3. Check Coolify logs

### If SSL not working:
1. Ensure DNS is pointing to correct IP
2. Disable Cloudflare proxy temporarily
3. Check Let's Encrypt rate limits

### If API not working:
1. Verify `chess-api.rndev.site` DNS record exists
2. Check Kong service logs in Coolify
3. Test with: `curl https://chess-api.rndev.site/auth/v1/health`

## Security Reminders

✅ Your `.env.production` file has:
- Unique JWT_SECRET generated
- Strong POSTGRES_PASSWORD
- Secure SECRET_KEY_BASE
- Random DB_ENC_KEY

⚠️ **Keep `.env.production` file secure - it contains your passwords!**

## Support

Need help? 
- Check main guide: `COOLIFY_DOMAIN_SETUP.md`
- Coolify Discord: https://discord.gg/coolify
- Create issue: https://github.com/bezalel6/next-chess/issues