require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { proxyHandler } = require('./proxyHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // izinkan embedding
}));

app.use(cors({ origin: '*' }));

// ─── Rate limit khusus proxy (lebih tinggi karena grid foto) ─
app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 500,
  message: { error: 'Terlalu banyak permintaan ke proxy.' },
}));

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'image-proxy' })
);

// ─── Proxy route ──────────────────────────────────────────────
// /proxy/:bucket/<object_key_yang_bisa_mengandung_slash>
app.get('/proxy/:bucket/*', proxyHandler);

// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Tidak ditemukan.' }));

app.listen(PORT, () => {
  console.log(`[Image Proxy] Berjalan di http://0.0.0.0:${PORT}`);
});
