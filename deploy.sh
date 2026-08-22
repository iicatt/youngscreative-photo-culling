#!/bin/bash
# ============================================================
# CFC (Culling Foto Creative) — Deploy Script untuk Ubuntu VPS
# Jalankan sebagai root: bash deploy.sh
# ============================================================

set -e  # Stop jika ada error

SERVER_IP="116.193.191.151"
DOMAIN=""          # Isi domain jika ada, kosongkan jika pakai IP
APP_DIR="/opt/youngscreative"
REPO_URL="https://github.com/iicatt/youngscreative-photo-culling.git"

# ── Warna output ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  CFC (Culling Foto Creative) — VPS Deploy${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ── 1. Update sistem & install dependensi ────────────────────
info "Update sistem..."
apt-get update -qq
apt-get upgrade -y -qq

info "Install dependensi dasar..."
apt-get install -y -qq \
  curl wget git ufw nginx \
  ca-certificates gnupg lsb-release \
  apt-transport-https software-properties-common

# ── 2. Install Docker ─────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  info "Install Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker terinstall: $(docker --version)"
else
  log "Docker sudah ada: $(docker --version)"
fi

# Docker Compose plugin
if ! docker compose version &> /dev/null; then
  info "Install Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
log "Docker Compose: $(docker compose version)"

# ── 3. Clone / update repo ───────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  info "Update repo dari GitHub..."
  cd "$APP_DIR"
  git pull origin main
else
  info "Clone repo dari GitHub..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
log "Repo siap di $APP_DIR"

# ── 4. Buat .env production ───────────────────────────────────
info "Buat file .env production..."
if [ ! -f "$APP_DIR/.env" ]; then
  # Generate password acak
  PG_PASS=$(openssl rand -base64 24 | tr -d '=+/' | head -c 20)
  MINIO_PASS=$(openssl rand -base64 24 | tr -d '=+/' | head -c 20)
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '=+/')
  PROXY_SECRET=$(openssl rand -base64 24 | tr -d '=+/')

  cat > "$APP_DIR/.env" << EOF
NODE_ENV=production

# PostgreSQL
POSTGRES_DB=youngscreative
POSTGRES_USER=ycuser
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgresql://ycuser:${PG_PASS}@postgres:5432/youngscreative

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASS}
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=${MINIO_PASS}

# Backend
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://${SERVER_IP}
PORT=4000

# Image Proxy
WATERMARK_TEXT=© Young's Creative
PROXY_SECRET=${PROXY_SECRET}

# Photo Quality Service
BLUR_THRESHOLD=100
EAR_THRESHOLD=0.21
HAMMING_THRESHOLD=5
PHOTO_QUALITY_URL=http://photo-quality-service:6000

# Frontend (dari perspektif browser)
VITE_API_URL=http://${SERVER_IP}/api
VITE_PROXY_URL=http://${SERVER_IP}/proxy
EOF
  log ".env production dibuat dengan password acak"
  warn "Simpan password ini di tempat aman!"
  echo "   PostgreSQL Password: $PG_PASS"
  echo "   MinIO Password     : $MINIO_PASS"
else
  log ".env sudah ada, dipakai yang existing"
fi

# ── 5. Buat docker-compose.prod.yml ──────────────────────────
info "Buat docker-compose.prod.yml..."
cat > "$APP_DIR/docker-compose.prod.yml" << 'COMPOSE'
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: yc_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/01_init.sql:ro
    networks: [yc_network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: yc_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BROWSER_REDIRECT_URL: http://116.193.191.151:9001
      MINIO_SERVER_URL: http://116.193.191.151/minio-upload
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks: [yc_network]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: yc_backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}
      CORS_ORIGIN: ${CORS_ORIGIN}
    ports:
      - "4000:4000"
    networks: [yc_network]

  image-proxy:
    build:
      context: ./image-proxy
      dockerfile: Dockerfile
    container_name: yc_image_proxy
    restart: unless-stopped
    depends_on:
      minio:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 5000
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      WATERMARK_TEXT: ${WATERMARK_TEXT}
      PROXY_SECRET: ${PROXY_SECRET}
    ports:
      - "5000:5000"
    networks: [yc_network]

  photo-quality-service:
    build:
      context: ./photo-quality-service
      dockerfile: Dockerfile
    container_name: yc_quality
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      PORT: 6000
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: false
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      BLUR_THRESHOLD: ${BLUR_THRESHOLD:-100}
      EAR_THRESHOLD: ${EAR_THRESHOLD:-0.21}
      HAMMING_THRESHOLD: ${HAMMING_THRESHOLD:-5}
    networks: [yc_network]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
        VITE_PROXY_URL: ${VITE_PROXY_URL}
    container_name: yc_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    networks: [yc_network]

volumes:
  postgres_data:
  minio_data:

networks:
  yc_network:
    driver: bridge
COMPOSE
log "docker-compose.prod.yml dibuat"

# ── 6. Update frontend Dockerfile untuk production build ─────
info "Update frontend Dockerfile untuk production..."
cat > "$APP_DIR/frontend/Dockerfile" << 'DOCKERFILE'
# Stage 1: Build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
ARG VITE_API_URL
ARG VITE_PROXY_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PROXY_URL=$VITE_PROXY_URL
RUN npm run build

# Stage 2: Nginx serve static files
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

# ── 7. Update nginx.conf frontend untuk proxy API ────────────
info "Update nginx.conf frontend..."
cat > "$APP_DIR/frontend/nginx.conf" << 'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
NGINX

# ── 8. Setup Nginx reverse proxy di host ─────────────────────
info "Setup Nginx reverse proxy..."
cat > /etc/nginx/sites-available/youngscreative << NGINX_CONF
server {
    listen 80;
    server_name ${SERVER_IP} ${DOMAIN};

    client_max_body_size 10G;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;

    # Frontend React
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Image Proxy
    location /proxy/ {
        proxy_pass http://127.0.0.1:5000/proxy/;
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_CONF

# Enable site
ln -sf /etc/nginx/sites-available/youngscreative /etc/nginx/sites-enabled/youngscreative
rm -f /etc/nginx/sites-enabled/default

nginx -t || err "Nginx config error — cek output di atas"
systemctl enable nginx
systemctl start nginx 2>/dev/null || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx
log "Nginx reverse proxy dikonfigurasi"

# ── 9. Update .env untuk single-origin via Nginx ─────────────
info "Update VITE URLs untuk single-origin..."
sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://${SERVER_IP}/api|" "$APP_DIR/.env"
sed -i "s|VITE_PROXY_URL=.*|VITE_PROXY_URL=http://${SERVER_IP}|" "$APP_DIR/.env"
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://${SERVER_IP}|" "$APP_DIR/.env"

# ── 10. Firewall ──────────────────────────────────────────────
info "Konfigurasi firewall UFW..."
ufw --force enable
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 9001/tcp  # MinIO console (opsional, bisa di-close nanti)
log "Firewall aktif: SSH, HTTP, HTTPS, MinIO Console"

# ── 11. Build & jalankan Docker Compose ──────────────────────
cd "$APP_DIR"
info "Build Docker images (ini bisa 5-15 menit pertama kali)..."
docker compose -f docker-compose.prod.yml --env-file .env build

info "Jalankan semua service..."
docker compose -f docker-compose.prod.yml --env-file .env up -d

# ── 12. Tunggu service ready ──────────────────────────────────
info "Menunggu service siap (30 detik)..."
sleep 30

# ── 13. Cek status ────────────────────────────────────────────
echo ""
log "=== STATUS SERVICE ==="
docker compose -f docker-compose.prod.yml ps

echo ""
log "=== HEALTH CHECK ==="
curl -sf http://localhost:4000/health && echo "  Backend API  ✓" || echo "  Backend API  ✗"
curl -sf http://localhost:5000/health && echo "  Image Proxy  ✓" || echo "  Image Proxy  ✗"

# ── 14. Setup auto-start ──────────────────────────────────────
info "Setup systemd auto-start..."
cat > /etc/systemd/system/youngscreative.service << SERVICE
[Unit]
Description=CFC (Culling Foto Creative) App
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable youngscreative
log "Auto-start aktif — app akan otomatis jalan saat server restart"

# ── Selesai ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  DEPLOY BERHASIL!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  App URL       : ${CYAN}http://${SERVER_IP}${NC}"
echo -e "  MinIO Console : ${CYAN}http://${SERVER_IP}:9001${NC}"
echo -e "  Login Demo    : ${CYAN}fotografer@demo.com / password123${NC}"
echo ""
echo -e "${YELLOW}  Lihat log: docker compose -f ${APP_DIR}/docker-compose.prod.yml logs -f${NC}"
echo ""
