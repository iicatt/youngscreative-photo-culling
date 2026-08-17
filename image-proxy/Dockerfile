# ── Stage 1: dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Sharp memerlukan libvips — sudah tersedia di linux/musl via npm
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Install nodemon untuk development
RUN npm install -g nodemon

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

CMD ["sh", "-c", "if [ \"$NODE_ENV\" = 'production' ]; then node src/index.js; else nodemon src/index.js; fi"]
