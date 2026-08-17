# CFC (Culling Foto Creative) — Sistem Seleksi Foto

Sistem manajemen dan seleksi foto berbasis web dengan penyimpanan terpusat MinIO.

## Stack

| Layanan       | Teknologi          | Port  |
|---------------|--------------------|-------|
| Frontend      | React + Vite       | 3000  |
| Backend API   | Express.js         | 4000  |
| Image Proxy   | Express + Sharp    | 5000  |
| Database      | PostgreSQL 16      | 5432  |
| Object Storage| MinIO              | 9000 (API), 9001 (Console) |

## Mulai Cepat

### 1. Siapkan environment
```bash
cp .env.example .env
# Edit .env — ganti semua nilai password dan secret
```

### 2. Jalankan semua layanan
```bash
docker compose up --build -d
```

### 3. Akses aplikasi
- **Frontend (Fotografer):** http://localhost:3000
- **MinIO Console:** http://localhost:9001
- **Backend API:** http://localhost:4000/health
- **Image Proxy:** http://localhost:5000/health

### 4. Login demo
- Email: `fotografer@demo.com`
- Password: `password123`

## Alur Kerja

```
Fotografer Login
  → Buat Sesi Baru (otomatis buat bucket MinIO)
  → Unggah Foto (drag & drop, hingga 100 file sekaligus)
  → Salin Tautan Klien → Kirim ke klien

Klien (via tautan token)
  → Lihat grid thumbnail (dengan watermark)
  → Klik foto → Pilih status: Siap Edit / Revisi / Ditolak
  → Tambah catatan → Simpan

Fotografer
  → Dashboard: lihat ringkasan jumlah per status
  → Unduh Seleksi: file JSON daftar foto Siap Edit
  → Tutup Sesi saat selesai
```

## Image Proxy

Format URL: `http://localhost:5000/proxy/{bucket}/{object_key}?preset=thumb&wm=1`

| Parameter | Nilai          | Default | Keterangan              |
|-----------|----------------|---------|-------------------------|
| `preset`  | thumb/medium/full | —    | Override w/h otomatis   |
| `w`       | angka px       | 800     | Lebar output            |
| `h`       | angka px       | —       | Tinggi output           |
| `wm`      | 0 / 1          | 1       | Tampilkan watermark     |
| `fmt`     | jpeg/webp/png  | jpeg    | Format output           |
| `q`       | 1–100          | 80      | Kualitas kompresi       |

## Struktur Proyek

```
cfc-foto/
├── docker-compose.yml
├── .env.example
├── database/
│   └── init.sql              # Schema PostgreSQL
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── config/           # db.js, minio.js
│       ├── middleware/       # auth.js, errorHandler.js
│       ├── controllers/      # authController, sesiController, fotoController
│       └── routes/           # authRoutes, sesiRoutes, klienRoutes
├── image-proxy/
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── proxyHandler.js   # Resize + watermark pipeline
│       ├── watermark.js      # SVG watermark generator
│       └── config/minio.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── App.jsx
        ├── store/            # Zustand auth store
        ├── services/         # Axios API client, proxyUrl helper
        ├── pages/            # Login, Dashboard, SesiDetail, Upload, Klien*
        └── components/       # Navbar, StatusBadge, Spinner, UploadZone
```

## API Endpoints

### Fotografer (memerlukan JWT)
| Method | Path | Keterangan |
|--------|------|------------|
| POST | `/api/auth/login` | Login |
| GET  | `/api/auth/me` | Info user |
| GET  | `/api/sesi` | Daftar sesi |
| POST | `/api/sesi` | Buat sesi baru |
| GET  | `/api/sesi/:id` | Detail sesi |
| PATCH | `/api/sesi/:id/tutup` | Tutup sesi |
| GET  | `/api/sesi/:id/unduh-seleksi` | Download JSON seleksi |
| GET  | `/api/sesi/:id/foto` | Daftar foto |
| POST | `/api/sesi/:id/foto/upload` | Upload massal |
| DELETE | `/api/sesi/:id/foto/:fotoId` | Hapus foto |

### Klien (via token, tanpa login)
| Method | Path | Keterangan |
|--------|------|------------|
| GET  | `/api/klien/:token/foto` | Daftar foto sesi |
| PATCH | `/api/klien/:token/foto/:fotoId` | Update status seleksi |
