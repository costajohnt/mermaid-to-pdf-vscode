# Enhanced MCP Server Dockerfile
FROM node:20-slim

# Install system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create cache directory
RUN mkdir -p /app/cache && chown -R pptruser:pptruser /app/cache

# Switch to non-root user
USER pptruser

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV CACHE_ENABLED=true
ENV CACHE_BACKEND=memory
ENV RATE_LIMIT_ENABLED=true
ENV MONITORING_ENABLED=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Expose port (if running HTTP mode)
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]