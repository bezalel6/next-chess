#!/bin/bash

# Fetch Coolify logs from remote server
# Usage: ./fetch-coolify-logs.sh [deployment-id]

# Configuration
REMOTE_HOST="rndev@rndev.local"
REMOTE_USER="root"  # Change to rndev if needed
OUTPUT_DIR="./logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="${OUTPUT_DIR}/coolify_logs_${TIMESTAMP}.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create logs directory if it doesn't exist
mkdir -p ${OUTPUT_DIR}

echo -e "${GREEN}=== Fetching Coolify Logs from ${REMOTE_HOST} ===${NC}"
echo "Output will be saved to: ${OUTPUT_FILE}"
echo ""

# Get deployment ID from argument or find latest
DEPLOYMENT_ID=$1

# SSH command function
run_remote() {
    ssh ${REMOTE_HOST} "$1" 2>/dev/null
}

# Start logging
{
    echo "=== Coolify Logs Fetch ==="
    echo "Timestamp: $(date)"
    echo "Remote Host: ${REMOTE_HOST}"
    echo "Deployment ID: ${DEPLOYMENT_ID:-auto-detect}"
    echo "=========================================="
    echo ""

    echo "=== Docker Containers Status ==="
    run_remote "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E '(chess|kong|auth|realtime|storage|postgres|rest|app)' || echo 'No chess-related containers found'"
    echo ""

    echo "=== All Containers (including stopped) ==="
    run_remote "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}' | grep -E '(chess|kong|auth|realtime|storage|postgres|rest|app)' | head -20"
    echo ""

    # If no deployment ID provided, try to find the latest
    if [ -z "$DEPLOYMENT_ID" ]; then
        echo "=== Finding Latest Deployment ==="
        DEPLOYMENT_ID=$(run_remote "docker ps -a --format '{{.Names}}' | grep -E 'postgres-.*-[0-9]+$' | head -1 | sed 's/postgres-//' | sed 's/-[0-9]*$//'")
        echo "Auto-detected deployment ID: ${DEPLOYMENT_ID:-none found}"
        echo ""
    fi

    if [ -n "$DEPLOYMENT_ID" ]; then
        echo "=== Service Logs for Deployment: ${DEPLOYMENT_ID} ==="
        
        # List of services to check
        SERVICES=("postgres" "rest" "auth" "realtime" "storage" "kong" "app")
        
        for SERVICE in "${SERVICES[@]}"; do
            echo ""
            echo "--- ${SERVICE} logs ---"
            CONTAINER_NAME=$(run_remote "docker ps -a --format '{{.Names}}' | grep -E '^${SERVICE}-${DEPLOYMENT_ID}' | head -1")
            
            if [ -n "$CONTAINER_NAME" ]; then
                echo "Container: ${CONTAINER_NAME}"
                run_remote "docker logs ${CONTAINER_NAME} --tail 50 2>&1" || echo "Failed to get logs for ${SERVICE}"
            else
                echo "No container found for ${SERVICE}"
            fi
            echo "--- End of ${SERVICE} logs ---"
        done
    fi

    echo ""
    echo "=== Coolify Proxy (Traefik) Logs ==="
    run_remote "docker logs coolify-proxy --tail 30 2>&1 | grep -v DEBUG" || echo "Failed to get proxy logs"
    
    echo ""
    echo "=== Network Configuration ==="
    run_remote "docker network inspect coolify --format '{{json .Containers}}' | python3 -m json.tool 2>/dev/null | head -50" || \
        run_remote "docker network inspect coolify | grep -A 5 'Containers'" || \
        echo "Failed to inspect network"
    
    echo ""
    echo "=== Port Usage ==="
    run_remote "netstat -tlnp 2>/dev/null | grep -E ':(3000|5432|8000|8080|8443|9999|4000|5000)' | head -20" || \
        run_remote "ss -tlnp | grep -E ':(3000|5432|8000|8080|8443|9999|4000|5000)' | head -20" || \
        echo "Failed to check ports"
    
    echo ""
    echo "=== Docker Resource Usage ==="
    run_remote "docker stats --no-stream --format 'table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' | grep -E '(chess|kong|auth|realtime|storage|postgres|rest|app)'" || \
        echo "Failed to get resource stats"
    
    echo ""
    echo "=== Recent Docker Events ==="
    run_remote "docker events --since '10m ago' --until '1s ago' --format '{{.Time}} {{.Actor.Attributes.name}} {{.Action}}' | grep -E '(chess|kong|auth|realtime|storage|postgres|rest|app)' | tail -20" || \
        echo "No recent events"
    
    echo ""
    echo "=== System Resources ==="
    run_remote "free -h && echo '' && df -h | grep -E '(/$|/var/lib/docker)' && echo '' && uptime"
    
    echo ""
    echo "=========================================="
    echo "Log fetch completed at: $(date)"
    
} > "${OUTPUT_FILE}" 2>&1

# Check if log fetch was successful
if [ -s "${OUTPUT_FILE}" ]; then
    echo -e "${GREEN}✓ Logs successfully saved to: ${OUTPUT_FILE}${NC}"
    echo ""
    echo "Quick summary:"
    grep -c "Up " "${OUTPUT_FILE}" | xargs echo "  - Running containers:"
    grep -c "Exited\|Restarting" "${OUTPUT_FILE}" | xargs echo "  - Failed/stopped containers:"
    echo ""
    echo -e "${YELLOW}To view the logs:${NC}"
    echo "  cat ${OUTPUT_FILE}"
    echo "  less ${OUTPUT_FILE}"
    echo "  code ${OUTPUT_FILE}  # Open in VS Code"
else
    echo -e "${RED}✗ Failed to fetch logs. Check your SSH connection to ${REMOTE_HOST}${NC}"
    exit 1
fi