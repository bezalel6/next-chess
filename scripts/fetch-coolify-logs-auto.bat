@echo off
setlocal EnableDelayedExpansion

REM Automated Coolify logs fetcher with sshpass
REM Usage: fetch-coolify-logs-auto.bat [deployment-id]

REM Configuration
set REMOTE_HOST=rndev.local
set REMOTE_USER=rndev
set REMOTE_PASS=123456
set OUTPUT_DIR=logs
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set OUTPUT_FILE=%OUTPUT_DIR%\coolify_logs_%TIMESTAMP%.txt
set DEPLOYMENT_ID=%1

REM Create logs directory if it doesn't exist
if not exist %OUTPUT_DIR% mkdir %OUTPUT_DIR%

echo === Fetching Coolify Logs from %REMOTE_USER%@%REMOTE_HOST% ===
echo Output will be saved to: %OUTPUT_FILE%
echo.

REM Check if plink is available (PuTTY's command line tool)
where plink >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: plink not found. Using standard SSH ^(will prompt for password^)
    echo Install PuTTY to enable automatic authentication
    echo.
    goto :USE_SSH
)

REM Use plink for automated SSH with password
echo Using plink for automated connection...
(
echo echo "=== Coolify Logs Fetch ==="
echo date
echo echo "=========================================="
echo echo ""
echo docker ps --format 'table {{.Names}}\t{{.Status}}' ^| grep -E '^(chess^|kong^|auth^|realtime^|storage^|postgres^|rest^|app^)'
echo echo ""
echo docker ps -a --format 'table {{.Names}}\t{{.Status}}' ^| grep -E '^(chess^|kong^|auth^|realtime^|storage^|postgres^|rest^|app^)' ^| head -20
echo echo ""
echo echo "=== Coolify Proxy Logs ==="
echo docker logs coolify-proxy --tail 20 2^>^&1 ^| grep -v DEBUG
echo echo ""
echo echo "=== Finding deployment containers ==="
echo docker ps -a --format '{{.Names}}' ^| grep -E '^(postgres^|app^|kong^)-.*-[0-9]+$' ^| head -10
) | plink -batch -pw %REMOTE_PASS% %REMOTE_USER%@%REMOTE_HOST% "sudo bash" > %OUTPUT_FILE% 2>&1
goto :CHECK_OUTPUT

:USE_SSH
REM Fallback to standard SSH
ssh %REMOTE_USER%@%REMOTE_HOST% "sudo bash -c 'docker ps --format \"table {{.Names}}\t{{.Status}}\" | grep -E \"(chess|kong|auth|realtime|storage|postgres|rest|app)\" && echo \"\" && docker logs coolify-proxy --tail 20 2>&1 | grep -v DEBUG'" > %OUTPUT_FILE% 2>&1

:CHECK_OUTPUT
REM Check if log fetch was successful
if exist %OUTPUT_FILE% (
    for %%A in (%OUTPUT_FILE%) do set SIZE=%%~zA
    if !SIZE! GTR 0 (
        echo.
        echo [92m✓ Logs successfully saved to: %OUTPUT_FILE%[0m
        echo.
        echo To view: code %OUTPUT_FILE%
    ) else (
        echo [91m✗ Log file is empty[0m
        exit /b 1
    )
) else (
    echo [91m✗ Failed to fetch logs[0m
    exit /b 1
)

endlocal