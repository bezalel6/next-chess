# Coolify Deployment Guide

This guide explains how to deploy Next Chess on Coolify with all services self-hosted.

## Overview

This deployment includes a complete Supabase stack:
- PostgreSQL database
- Authentication service (GoTrue)
- Realtime WebSocket service
- Storage service
- REST API (PostgREST)
- Kong API Gateway
- Next.js application

## Prerequisites

- Coolify instance running (v4.0+)
- Domain name configured
- SSL certificates (Coolify can manage with Let's Encrypt)

## Deployment Steps

### 1. Create New Project in Coolify

1. Log into your Coolify dashboard
2. Click "New Project"
3. Name it "next-chess"

### 2. Add Resource

1. Select "Docker Compose" as resource type
2. Choose your server
3. Set the Git repository URL

### 3. Configure Environment Variables

In Coolify's environment variables section, add:

```env
# Required - Update with your domain
SITE_URL=https://chess.yourdomain.com
API_EXTERNAL_URL=https://chess-api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://chess-api.yourdomain.com

# Security - Generate new values for production
JWT_SECRET=<generate-with-openssl-rand-base64-32>
POSTGRES_PASSWORD=<strong-password>

# Optional - Email configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-api-key>
```

### 4. Docker Compose Configuration

1. In Coolify, set the compose file to: `docker-compose.coolify.yml`
2. Or paste the contents directly into Coolify's compose editor

### 5. Network Configuration

Coolify requires specific network setup:

1. **Main App Service**: 
   - Set public port to 3000
   - Enable "Expose to Internet"
   - Configure domain: `chess.yourdomain.com`

2. **Kong API Gateway**:
   - Set public port to 54321
   - Enable "Expose to Internet"
   - Configure domain: `chess-api.yourdomain.com`

### 6. Volume Persistence

Coolify automatically manages volumes. Ensure these are configured:
- `postgres_data`: PostgreSQL data
- `storage_data`: File storage

### 7. Build Configuration

In Coolify's build settings:
- Build Pack: Docker
- Dockerfile: `Dockerfile`
- Build Context: `.`

### 8. Deploy

1. Click "Deploy"
2. Monitor logs for any issues
3. Wait for all services to be healthy (2-3 minutes)

## Post-Deployment

### 1. Initialize Database

If migrations don't run automatically:

```bash
# SSH into Coolify server
docker exec -it <postgres-container> psql -U postgres -d next_chess < /docker-entrypoint-initdb.d/00-init.sql
```

### 2. Verify Services

Check all services are running:
- Main app: `https://chess.yourdomain.com`
- API health: `https://chess-api.yourdomain.com/rest/v1/`

### 3. Configure DNS

Add these DNS records:
```
A    chess              -> Your_Server_IP
A    chess-api          -> Your_Server_IP
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SITE_URL` | Main application URL | `https://chess.yourdomain.com` |
| `API_EXTERNAL_URL` | API Gateway URL | `https://chess-api.yourdomain.com` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Generate with `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Database password | Strong password |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_DB` | Database name | `next_chess` |
| `NODE_ENV` | Environment | `production` |
| `DISABLE_SIGNUP` | Disable new signups | `false` |
| `EMAIL_ENABLED` | Enable email | `true` |
| `EMAIL_AUTOCONFIRM` | Auto-confirm emails | `false` |

## Scaling in Coolify

### Horizontal Scaling

1. **Application Replicas**:
   ```yaml
   app:
     deploy:
       replicas: 3
   ```

2. **Load Balancing**:
   - Coolify handles this automatically with Traefik

### Resource Limits

Add to your service definitions:
```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2048M
      reservations:
        cpus: '1'
        memory: 1024M
```

## Monitoring

### Health Checks

The compose file includes health checks for all services. Monitor in Coolify dashboard.

### Logs

View logs in Coolify:
1. Go to your deployment
2. Click "Logs" tab
3. Select service to view

Or via SSH:
```bash
docker-compose -f docker-compose.coolify.yml logs -f [service-name]
```

## Backup Strategy

### Database Backup

Create automated backup script:
```bash
#!/bin/bash
# Run daily via Coolify's cron jobs
docker exec postgres pg_dump -U postgres next_chess > /backups/chess_$(date +%Y%m%d).sql
```

### Volume Backup

Backup persistent volumes:
```bash
docker run --rm -v next-chess_postgres_data:/data -v /backups:/backup alpine tar czf /backup/postgres_data.tar.gz /data
```

## Troubleshooting

### Services Not Starting

1. Check Coolify logs for errors
2. Verify environment variables are set
3. Ensure ports aren't conflicting

### Database Connection Issues

1. Check PostgreSQL is healthy:
   ```bash
   docker-compose ps postgres
   ```
2. Verify connection string in env vars

### Realtime Not Working

1. Check WebSocket support in Coolify/Traefik
2. Verify Kong configuration
3. Check browser console for WS errors

### SSL Certificate Issues

1. Verify DNS is pointing to server
2. Check Coolify's Let's Encrypt logs
3. Ensure ports 80/443 are open

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated new JWT secret
- [ ] Configured SSL certificates
- [ ] Set up firewall rules
- [ ] Enabled rate limiting in Kong
- [ ] Configured backup strategy
- [ ] Set resource limits
- [ ] Disabled signup if needed
- [ ] Configured email authentication

## Support

For issues specific to:
- **Coolify**: Check Coolify documentation or Discord
- **Next Chess**: Open issue on GitHub
- **Supabase services**: Check Supabase self-hosting docs