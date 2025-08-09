#!/bin/bash

# Generate Coolify Environment Variables
echo "Generating secure environment variables for Coolify deployment..."
echo "=========================================================="
echo ""

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: ./generate-coolify-env.sh yourdomain.com"
    echo "Example: ./generate-coolify-env.sh example.com"
    exit 1
fi

DOMAIN=$1

# Generate secure passwords and secrets
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '\n')
DB_ENC_KEY=$(openssl rand -hex 16)

# Create .env.production file
cat > .env.production << EOF
# Generated Environment Variables for Coolify Deployment
# Domain: ${DOMAIN}
# Generated: $(date)

# === URLs Configuration ===
SITE_URL=https://chess.${DOMAIN}
API_EXTERNAL_URL=https://chess-api.${DOMAIN}
NEXT_PUBLIC_SUPABASE_URL=https://chess-api.${DOMAIN}

# === Security Keys (Generated) ===
JWT_SECRET=${JWT_SECRET}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
DB_ENC_KEY=${DB_ENC_KEY}

# === Database Configuration ===
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=next_chess

# === Supabase Keys (Default - Can be regenerated) ===
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# === Email Configuration (Development) ===
EMAIL_ENABLED=true
EMAIL_AUTOCONFIRM=true
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SENDER_NAME=Next Chess
SMTP_ADMIN_EMAIL=admin@${DOMAIN}

# === Application Settings ===
NODE_ENV=production
SKIP_ENV_VALIDATION=true
DISABLE_SIGNUP=false

# === Port Configuration ===
APP_PORT=3000
KONG_PORT=54321
EOF

echo "✅ Environment file generated: .env.production"
echo ""
echo "📋 DNS Records to add:"
echo "=========================================="
echo "Type  Name         Value"
echo "A     chess        YOUR_SERVER_IP"
echo "A     chess-api    YOUR_SERVER_IP"
echo "=========================================="
echo ""
echo "🌐 Your URLs will be:"
echo "  Main App: https://chess.${DOMAIN}"
echo "  API:      https://chess-api.${DOMAIN}"
echo ""
echo "🔐 Secure values generated:"
echo "  - JWT_SECRET (32 bytes)"
echo "  - POSTGRES_PASSWORD (24 bytes)"
echo "  - SECRET_KEY_BASE (64 bytes)"
echo "  - DB_ENC_KEY (16 bytes)"
echo ""
echo "📝 Next steps:"
echo "  1. Add DNS records to your domain provider"
echo "  2. Copy .env.production contents to Coolify"
echo "  3. Deploy the application"
echo ""
echo "⚠️  IMPORTANT: Save .env.production in a secure location!"