# Stage 1: Build
FROM node:20-bullseye-slim AS build

WORKDIR /app

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for potential build steps)
RUN npm install

# Copy application files
COPY . .

# Rebuild native modules for the current architecture
RUN npm rebuild

# Stage 2: Production
FROM node:20-bullseye-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy from build stage
COPY --from=build /app /app

# Create required directories for persistence
RUN mkdir -p data/backup logs whatsapp-session

# Set environment variables
ENV NODE_ENV=production
ENV PORT=22917

# Expose port
EXPOSE 22917

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:22917/health || exit 1

# Start application (Initialize database then start)
CMD ["sh", "-c", "node scripts/init-database.js && node app.js"]

