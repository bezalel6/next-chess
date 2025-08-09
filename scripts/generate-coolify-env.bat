@echo off
setlocal enabledelayedexpansion

echo Generating secure environment variables for Coolify deployment...
echo ==========================================================
echo.

if "%1"=="" (
    echo Usage: generate-coolify-env.bat yourdomain.com
    echo Example: generate-coolify-env.bat example.com
    exit /b 1
)

set DOMAIN=%1

echo Generating secure passwords and secrets...
echo.

REM Generate random values using PowerShell
for /f "delims=" %%i in ('powershell -command "[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))"') do set JWT_SECRET=%%i
for /f "delims=" %%i in ('powershell -command "[Convert]::ToBase64String((1..24 | ForEach-Object {Get-Random -Maximum 256}))"') do set POSTGRES_PASSWORD=%%i
for /f "delims=" %%i in ('powershell -command "[Convert]::ToBase64String((1..64 | ForEach-Object {Get-Random -Maximum 256}))"') do set SECRET_KEY_BASE=%%i
for /f "delims=" %%i in ('powershell -command "-join ((1..16 | ForEach-Object {'{0:x2}' -f (Get-Random -Maximum 256)}))"') do set DB_ENC_KEY=%%i

REM Get current date
for /f "delims=" %%i in ('powershell -command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"') do set CURRENT_DATE=%%i

REM Create .env.production file
(
echo # Generated Environment Variables for Coolify Deployment
echo # Domain: %DOMAIN%
echo # Generated: %CURRENT_DATE%
echo.
echo # === URLs Configuration ===
echo SITE_URL=https://chess.%DOMAIN%
echo API_EXTERNAL_URL=https://chess-api.%DOMAIN%
echo NEXT_PUBLIC_SUPABASE_URL=https://chess-api.%DOMAIN%
echo.
echo # === Security Keys ^(Generated^) ===
echo JWT_SECRET=%JWT_SECRET%
echo SECRET_KEY_BASE=%SECRET_KEY_BASE%
echo DB_ENC_KEY=%DB_ENC_KEY%
echo.
echo # === Database Configuration ===
echo POSTGRES_USER=postgres
echo POSTGRES_PASSWORD=%POSTGRES_PASSWORD%
echo POSTGRES_DB=next_chess
echo.
echo # === Supabase Keys ^(Default - Can be regenerated^) ===
echo ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
echo SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
echo.
echo # === Email Configuration ^(Development^) ===
echo EMAIL_ENABLED=true
echo EMAIL_AUTOCONFIRM=true
echo SMTP_HOST=mailhog
echo SMTP_PORT=1025
echo SMTP_SENDER_NAME=Next Chess
echo SMTP_ADMIN_EMAIL=admin@%DOMAIN%
echo.
echo # === Application Settings ===
echo NODE_ENV=production
echo SKIP_ENV_VALIDATION=true
echo DISABLE_SIGNUP=false
echo.
echo # === Port Configuration ===
echo APP_PORT=3000
echo KONG_PORT=54321
) > .env.production

echo.
echo ✅ Environment file generated: .env.production
echo.
echo 📋 DNS Records to add:
echo ==========================================
echo Type  Name         Value
echo A     chess        YOUR_SERVER_IP
echo A     chess-api    YOUR_SERVER_IP
echo ==========================================
echo.
echo 🌐 Your URLs will be:
echo   Main App: https://chess.%DOMAIN%
echo   API:      https://chess-api.%DOMAIN%
echo.
echo 🔐 Secure values generated:
echo   - JWT_SECRET (32 bytes)
echo   - POSTGRES_PASSWORD (24 bytes)
echo   - SECRET_KEY_BASE (64 bytes)
echo   - DB_ENC_KEY (16 bytes)
echo.
echo 📝 Next steps:
echo   1. Add DNS records to your domain provider
echo   2. Copy .env.production contents to Coolify
echo   3. Deploy the application
echo.
echo ⚠️  IMPORTANT: Save .env.production in a secure location!

pause