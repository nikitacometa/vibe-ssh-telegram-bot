# --- Build stage: compile TypeScript with full dependencies ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage: production dependencies + compiled output only ---
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

# Run as an unprivileged user; the bot holds SSH credentials, so it must not run as root
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p config && chown -R app:app /usr/src/app
USER app

CMD ["node", "dist/index.js"]
