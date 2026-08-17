# Young's Creative — AI Photo Culling System

> Full-stack aplikasi culling foto otomatis dengan AI quality detection untuk fotografer profesional.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?logo=postgresql)](https://www.postgresql.org/)

---

## ✨ Features

- 🤖 **AI Quality Detection** — Blur, eyes closed, duplicate detection via OpenCV & dlib
- 📸 **Fotografer Workspace** — Batch upload, AI culling, ekspor Lightroom
- 👥 **Klien Interface** — 3 mode seleksi (pilih sendiri / kurator / view only)
- 🔄 **Fase Workflow** — Pra-Edit → Pasca-Edit state management
- 📦 **ZIP Streaming** — Download foto asli + hasil edit dalam satu klik
- 🎨 **Material Design 3** — Modern dark theme, responsive mobile-first

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TailwindCSS, Zustand, React Query |
| **Backend** | Node.js 20, Express, PostgreSQL 14 |
| **Image Proxy** | Node.js, imgproxy, Sharp |
| **AI Service** | Python 3.11, FastAPI, OpenCV, dlib |
| **Storage** | MinIO (S3-compatible) |

---

## 📦 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Python 3.11+
- MinIO server
- imgproxy (optional)

### 1. Install Dependencies
```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install

# Image Proxy
cd image-proxy && npm install

# AI Service
cd photo-quality-service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Setup Database
```bash
psql -U postgres -c "CREATE DATABASE youngscreative;"
psql -U postgres -d youngscreative -f database/init.sql
psql -U postgres -d youngscreative -f database/migrate_quality.sql
psql -U postgres -d youngscreative -f database/migrate_v3_fase_mode.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env — sesuaikan DATABASE_URL, MINIO_ENDPOINT, JWT_SECRET, etc.
```

### 4. Start All Services
```bash
# Windows PowerShell
.\start-dev.ps1

# Cross-platform
python start-dev.py
```

### 5. Access
- **Fotografer:** http://localhost:3000
- **Klien:** http://localhost:3000/k/{TOKEN}
- **MinIO Console:** http://localhost:9001

**Default Login:**
```
Email: fotografer@demo.com
Password: password123
```

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    FOTOGRAFER WORKFLOW                       │
└─────────────────────────────────────────────────────────────┘
  1. Login → Dashboard
  2. New Session → Upload Foto (batch)
  3. AI Culling → Filter blur/eyes closed
  4. Seleksi Manual → Mark siap_edit/ditolak/revisi
  5. Export Lightroom ZIP → Edit di Lightroom Classic
  6. Upload Hasil Edit → ZIP hasil edit final
  7. Tandai Selesai Edit → Fase: pasca_edit
  8. Share Token ke Klien

┌─────────────────────────────────────────────────────────────┐
│                      KLIEN WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘
  1. Buka Link Token → Landing Page
  2. Pilih Mode Seleksi:
     - Pilih Sendiri → Review semua foto
     - Sudah Dipilihkan → Review shortlist fotografer
     - Lihat-Lihat → View only (pasca-edit)
  3. Review Foto → Approve/Revisi/Tolak
  4. Download ZIP → Foto asli + hasil edit final
```

---

## 📁 Project Structure

```
youngscreative/
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/   # Reusable UI
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API client
│   │   └── store/        # Zustand state
│   └── package.json
│
├── backend/              # Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── config/
│   └── package.json
│
├── image-proxy/          # imgproxy + watermark
│   ├── src/
│   │   ├── proxyHandler.js
│   │   └── watermark.js
│   └── package.json
│
├── photo-quality-service/  # AI detection
│   ├── app/
│   │   ├── analyzers/   # Blur, eyes, duplicate
│   │   ├── core/
│   │   └── main.py
│   └── requirements.txt
│
├── database/             # SQL migrations
│   ├── init.sql
│   └── migrate_*.sql
│
└── BUG_FIX_REPORT.md     # Bug analysis (9 total)
```

---

## 🐛 Bug Fixes

**9 bugs fixed** — See [BUG_FIX_REPORT.md](./BUG_FIX_REPORT.md):

1. ✅ Navbar broken routes (`/sessions`, `/uploads`)
2. ✅ KlienFotoDetail mode from sessionStorage → DB
3. ✅ DashboardPage full reload → `navigate()`
4. ✅ Browser popup blocking → ZIP streaming
5. ✅ Download placement (moved to Hasil Edit tab)
6. ✅ `fase_sesi` not sent to client
7. ✅ Sesi `selesai` inaccessible
8. ✅ Route order `/download-zip`
9. ✅ Archiver v8 → downgraded to v5.3.2

---

## 📄 License

MIT © Young's Creative Team
