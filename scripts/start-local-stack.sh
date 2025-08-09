#!/bin/bash

echo "Starting Next Chess with Local Supabase Stack..."
echo "================================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Copy environment variables
if [ ! -f .env ]; then
    echo "Creating .env file from .env.local-stack..."
    cp .env.local-stack .env
fi

# Start the services
echo "Starting all services..."
docker-compose -f docker-compose.full.yml up -d

# Wait for services to be ready
echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "Checking service status..."
docker-compose -f docker-compose.full.yml ps

echo ""
echo "================================================"
echo "Services are starting up!"
echo ""
echo "Access points:"
echo "  - Next.js App:        http://localhost:3000"
echo "  - Supabase Studio:    http://localhost:54323"
echo "  - API Gateway:        http://localhost:54321"
echo "  - PostgreSQL:         localhost:5432"
echo "  - MailHog:           http://localhost:8025"
echo ""
echo "To view logs: docker-compose -f docker-compose.full.yml logs -f"
echo "To stop:      docker-compose -f docker-compose.full.yml down"
echo "================================================"