# ── Stage 1: dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Install nodemon untuk development hot-reload
RUN npm install -g nodemon

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Jalankan sebagai user non-root untuk keamanan
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000

# Di development pakai nodemon, di production pakai node langsung
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = 'production' ]; then node src/index.js; else nodemon src/index.js; fi"]
