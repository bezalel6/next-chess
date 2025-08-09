@echo off
echo Starting Next Chess with Local Supabase Stack...
echo ================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker first.
    exit /b 1
)

REM Copy environment variables
if not exist .env (
    echo Creating .env file from .env.local-stack...
    copy .env.local-stack .env
)

REM Start the services
echo Starting all services...
docker-compose -f docker-compose.full.yml up -d

REM Wait for services to be ready
echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check service health
echo.
echo Checking service status...
docker-compose -f docker-compose.full.yml ps

echo.
echo ================================================
echo Services are starting up!
echo.
echo Access points:
echo   - Next.js App:        http://localhost:3000
echo   - Supabase Studio:    http://localhost:54323
echo   - API Gateway:        http://localhost:54321
echo   - PostgreSQL:         localhost:5432
echo   - MailHog:           http://localhost:8025
echo.
echo To view logs: docker-compose -f docker-compose.full.yml logs -f
echo To stop:      docker-compose -f docker-compose.full.yml down
echo ================================================