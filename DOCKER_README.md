# Docker Deployment Guide

## Building the Docker Image

### Option 1: Using docker-compose (Recommended)

1. Copy `.env.docker` to `.env` and fill in your actual values:
```bash
cp .env.docker .env
```

2. Build and run with docker-compose:
```bash
docker-compose up --build
```

### Option 2: Using docker build directly

Build the image with build arguments:
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  -t next-chess .
```

Run the container:
```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  -e DATABASE_URL="your-database-url" \
  next-chess
```

## Required Environment Variables

### Build-time variables (required for Next.js build):
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Runtime variables (required for server operation):
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `DATABASE_URL`: PostgreSQL connection string

## Production Deployment

For production, ensure you:
1. Use production Supabase credentials
2. Set proper resource limits in docker-compose
3. Use a reverse proxy (nginx, traefik) for SSL
4. Configure proper logging and monitoring