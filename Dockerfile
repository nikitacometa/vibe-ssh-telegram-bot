FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove source files after build
RUN rm -rf src/

# Create config directory
RUN mkdir -p config

# Expose port for health checks (optional)
EXPOSE 3000

# Run the bot
CMD ["node", "dist/index.js"]