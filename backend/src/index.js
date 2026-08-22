require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('express-async-errors');

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');

const authRoutes  = require('./routes/authRoutes');
const sesiRoutes  = require('./routes/sesiRoutes');
const klienRoutes = require('./routes/klienRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Trust Proxy (wajib jika di belakang Nginx/load balancer) ─
// '1' = percaya satu level proxy (Nginx)
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsers ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiter (global) ───────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 2000,                 // dinaikkan dari 200 — polling AI analysis butuh banyak request
  message: { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
  skip: (req) => {
    // Skip rate limit untuk request dari Docker internal network (quality service)
    const ip = req.ip || '';
    return ip.startsWith('172.') || ip.startsWith('10.') || ip === '::1' || ip === '127.0.0.1';
  },
}));

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backend' }));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/sesi',  sesiRoutes);
app.use('/api/klien', klienRoutes);

// ─── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// ─── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Backend] Berjalan di http://0.0.0.0:${PORT}`);
});

module.exports = app;
