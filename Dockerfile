# Use official Node.js LTS version on Debian Slim for stable DNS resolution and a lightweight footprint
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker layer caching for dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create the uploads directory and ensure it has correct permissions
RUN mkdir -p uploads && chown -R node:node /usr/src/app

# Run as non-root user for security
USER node

# Default port and environment variables
ENV PORT=5777
ENV NODE_ENV=production

# Expose the application port
EXPOSE 5777

# Start the server
CMD ["node", "server.js"]
