# Self-Hosted Deployment Guide

This guide explains how to deploy Next Chess with all services running locally, without any external dependencies.

## Architecture

The self-contained deployment includes:

- **PostgreSQL Database**: Main data storage
- **Supabase Services**:
  - Auth (GoTrue): Authentication service
  - Realtime: WebSocket connections for live updates
  - Storage: File storage service
  - PostgREST: RESTful API for database
  - Kong: API Gateway
- **Next.js Application**: The chess game frontend and backend
- **MailHog**: Local email testing (for auth emails)

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of RAM available for Docker
- Ports 3000, 5432, 54321, 54323, and 8025 available

## Quick Start

### Windows
```bash
scripts\start-local-stack.bat
```

### Linux/Mac
```bash
chmod +x scripts/start-local-stack.sh
./scripts/start-local-stack.sh
```

## Manual Setup

1. **Prepare environment variables:**
   ```bash
   cp .env.local-stack .env
   ```

2. **Start all services:**
   ```bash
   docker-compose -f docker-compose.full.yml up -d
   ```

3. **Wait for services to initialize** (about 30 seconds)

4. **Access the application:**
   - Chess Game: http://localhost:3000
   - Supabase Studio: http://localhost:54323
   - Mail Testing: http://localhost:8025

## Service URLs

| Service | Internal URL | External URL |
|---------|-------------|--------------|
| Next.js App | http://next-chess:3000 | http://localhost:3000 |
| PostgreSQL | postgres:5432 | localhost:5432 |
| Supabase API | http://kong:8000 | http://localhost:54321 |
| Supabase Studio | - | http://localhost:54323 |
| Auth Service | http://auth:9999 | via Kong |
| Realtime | http://realtime:4000 | via Kong |
| Storage | http://storage:5000 | via Kong |
| MailHog SMTP | mailhog:1025 | localhost:1025 |
| MailHog Web | - | http://localhost:8025 |

## Database Access

Connect to PostgreSQL:
```bash
docker-compose -f docker-compose.full.yml exec postgres psql -U postgres -d next_chess
```

Default credentials:
- Username: `postgres`
- Password: `postgres123`
- Database: `next_chess`

## Managing Services

### View logs
```bash
# All services
docker-compose -f docker-compose.full.yml logs -f

# Specific service
docker-compose -f docker-compose.full.yml logs -f next-chess
```

### Stop services
```bash
docker-compose -f docker-compose.full.yml down
```

### Stop and remove data
```bash
docker-compose -f docker-compose.full.yml down -v
```

### Restart a service
```bash
docker-compose -f docker-compose.full.yml restart next-chess
```

## Troubleshooting

### Services not starting
1. Check Docker is running
2. Ensure required ports are free
3. Check logs: `docker-compose -f docker-compose.full.yml logs`

### Database connection issues
1. Wait 30 seconds for PostgreSQL to fully initialize
2. Check PostgreSQL logs: `docker-compose -f docker-compose.full.yml logs postgres`

### Authentication not working
1. Check Auth service: `docker-compose -f docker-compose.full.yml logs auth`
2. Verify JWT secret is consistent across services
3. Check email in MailHog: http://localhost:8025

### Realtime not connecting
1. Check Realtime service: `docker-compose -f docker-compose.full.yml logs realtime`
2. Verify WebSocket connections are allowed
3. Check Kong gateway: `docker-compose -f docker-compose.full.yml logs kong`

## Production Deployment

For production use:

1. **Change default passwords and keys:**
   - Generate new JWT secret (32+ characters)
   - Change PostgreSQL password
   - Generate new anon and service role keys

2. **Configure email:**
   - Replace MailHog with actual SMTP service
   - Configure auth email templates

3. **Add SSL/TLS:**
   - Use reverse proxy (nginx, Traefik)
   - Configure SSL certificates

4. **Set resource limits:**
   - Add memory/CPU limits in docker-compose
   - Configure PostgreSQL for production workload

5. **Enable backups:**
   - Set up PostgreSQL backup strategy
   - Configure volume backups

## Security Considerations

- Change all default passwords and keys
- Enable firewall rules for production
- Use SSL/TLS for all external connections
- Implement rate limiting
- Configure CORS properly
- Enable audit logging
- Regular security updates

## Monitoring

Consider adding:
- Prometheus for metrics
- Grafana for visualization
- ELK stack for log aggregation
- Health check endpoints

## Scaling

To scale horizontally:
1. Use external PostgreSQL cluster
2. Deploy multiple Next.js instances
3. Use Redis for session storage
4. Implement load balancer
5. Consider Kubernetes for orchestration