# Multi-stage build for Next.js application with custom server

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files and .npmrc
COPY package*.json ./
COPY .npmrc ./

# Install dependencies including sharp for image optimization
RUN npm ci --legacy-peer-deps --no-audit --no-fund && \
    npm install sharp --no-save

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Build arguments for required environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Copy package files and .npmrc
COPY package*.json ./
COPY .npmrc ./

# Install all dependencies
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy application code
COPY . .

# Set environment variables for build
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Build the Next.js application
RUN npm run build:simple

# Copy and compile the custom server separately
COPY src/server/server.js ./src/server/server.js

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Copy compiled JavaScript server (not TypeScript)
COPY --from=builder /app/src/server/server.js ./server.js

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose the port Next.js runs on
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using the compiled JavaScript server
# No TSX overhead in production!
CMD ["node", "server.js"]