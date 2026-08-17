# ── Stage 1: development server (default) ─────────────────────
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Stage 2: production build ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Variabel di-inject via ARG saat build
ARG VITE_API_URL
ARG VITE_PROXY_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PROXY_URL=$VITE_PROXY_URL
RUN npm run build

# ── Stage 3: production serve via Nginx ───────────────────────
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
