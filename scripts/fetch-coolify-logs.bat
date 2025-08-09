@echo off
setlocal EnableDelayedExpansion

REM Fetch Coolify logs from remote server (Windows version)
REM Usage: fetch-coolify-logs.bat [deployment-id]

REM Configuration
set REMOTE_HOST=rndev@rndev.local
set OUTPUT_DIR=logs
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set OUTPUT_FILE=%OUTPUT_DIR%\coolify_logs_%TIMESTAMP%.txt
set DEPLOYMENT_ID=%1

REM Create logs directory if it doesn't exist
if not exist %OUTPUT_DIR% mkdir %OUTPUT_DIR%

echo === Fetching Coolify Logs from %REMOTE_HOST% ===
echo Output will be saved to: %OUTPUT_FILE%
echo.

REM Create temporary script file for SSH commands
set TEMP_SCRIPT=%TEMP%\coolify_fetch_%RANDOM%.sh
(
echo #!/bin/bash
echo echo "=== Coolify Logs Fetch ==="
echo echo "Timestamp: $(date)"
echo echo "Remote Host: %REMOTE_HOST%"
echo echo "Deployment ID: ${1:-auto-detect}"
echo echo "=========================================="
echo echo ""
echo.
echo echo "=== Docker Containers Status ==="
echo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' ^| grep -E '^(chess^|kong^|auth^|realtime^|storage^|postgres^|rest^|app^)' ^|^| echo 'No chess-related containers found'
echo echo ""
echo.
echo echo "=== All Containers ^(including stopped^) ==="
echo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}' ^| grep -E '^(chess^|kong^|auth^|realtime^|storage^|postgres^|rest^|app^)' ^| head -20
echo echo ""
echo.
echo # Find deployment ID if not provided
echo if [ -z "$1" ]; then
echo     echo "=== Finding Latest Deployment ==="
echo     DEPLOYMENT_ID=$(docker ps -a --format '{{.Names}}' ^| grep -E 'postgres-.*-[0-9]+$' ^| head -1 ^| sed 's/postgres-//' ^| sed 's/-[0-9]*$//')
echo     echo "Auto-detected deployment ID: ${DEPLOYMENT_ID:-none found}"
echo else
echo     DEPLOYMENT_ID=$1
echo fi
echo echo ""
echo.
echo if [ -n "$DEPLOYMENT_ID" ]; then
echo     echo "=== Service Logs for Deployment: ${DEPLOYMENT_ID} ==="
echo     SERVICES=^("postgres" "rest" "auth" "realtime" "storage" "kong" "app"^)
echo     for SERVICE in "${SERVICES[@]}"; do
echo         echo ""
echo         echo "--- ${SERVICE} logs ---"
echo         CONTAINER_NAME=$(docker ps -a --format '{{.Names}}' ^| grep -E "^^${SERVICE}-${DEPLOYMENT_ID}" ^| head -1^)
echo         if [ -n "$CONTAINER_NAME" ]; then
echo             echo "Container: ${CONTAINER_NAME}"
echo             docker logs ${CONTAINER_NAME} --tail 50 2^>^&1 ^|^| echo "Failed to get logs for ${SERVICE}"
echo         else
echo             echo "No container found for ${SERVICE}"
echo         fi
echo         echo "--- End of ${SERVICE} logs ---"
echo     done
echo fi
echo.
echo echo ""
echo echo "=== Coolify Proxy ^(Traefik^) Logs ==="
echo docker logs coolify-proxy --tail 30 2^>^&1 ^| grep -v DEBUG ^|^| echo "Failed to get proxy logs"
echo.
echo echo ""
echo echo "=== Network Configuration ==="
echo docker network inspect coolify ^| grep -A 5 'Containers' ^|^| echo "Failed to inspect network"
echo.
echo echo ""
echo echo "=== Port Usage ==="
echo ss -tlnp 2^>/dev/null ^| grep -E ':^(3000^|5432^|8000^|8080^|8443^|9999^|4000^|5000^)' ^| head -20 ^|^| echo "Failed to check ports"
echo.
echo echo ""
echo echo "=== Docker Resource Usage ==="
echo docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' ^| grep -E '^(chess^|kong^|auth^|realtime^|storage^|postgres^|rest^|app^)' ^|^| echo "Failed to get stats"
echo.
echo echo ""
echo echo "=== System Resources ==="
echo free -h ^&^& echo '' ^&^& df -h ^| grep -E '^(/$^|/var/lib/docker^)' ^&^& echo '' ^&^& uptime
echo.
echo echo ""
echo echo "=========================================="
echo echo "Log fetch completed at: $(date^)"
) > %TEMP_SCRIPT%

REM Execute the script via SSH and save output
echo Connecting to %REMOTE_HOST% and fetching logs...
ssh %REMOTE_HOST% "bash -s" %DEPLOYMENT_ID% < %TEMP_SCRIPT% > %OUTPUT_FILE% 2>&1

REM Clean up temp file
del %TEMP_SCRIPT% >nul 2>&1

REM Check if log fetch was successful
if exist %OUTPUT_FILE% (
    for %%A in (%OUTPUT_FILE%) do set SIZE=%%~zA
    if !SIZE! GTR 0 (
        echo.
        echo [92m✓ Logs successfully saved to: %OUTPUT_FILE%[0m
        echo.
        echo Quick summary:
        findstr /c:"Up " %OUTPUT_FILE% | find /c /v "" > temp.txt
        set /p RUNNING=<temp.txt
        echo   - Running containers: !RUNNING!
        findstr /c:"Exited" /c:"Restarting" %OUTPUT_FILE% | find /c /v "" > temp.txt
        set /p FAILED=<temp.txt
        echo   - Failed/stopped containers: !FAILED!
        del temp.txt >nul 2>&1
        echo.
        echo To view the logs:
        echo   type %OUTPUT_FILE%
        echo   notepad %OUTPUT_FILE%
        echo   code %OUTPUT_FILE%  (Open in VS Code)
    ) else (
        echo [91m✗ Log file is empty. Check your SSH connection to %REMOTE_HOST%[0m
        exit /b 1
    )
) else (
    echo [91m✗ Failed to fetch logs. Check your SSH connection to %REMOTE_HOST%[0m
    exit /b 1
)

endlocal