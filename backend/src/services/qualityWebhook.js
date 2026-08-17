/**
 * qualityWebhook.js
 * ==================
 * Fire-and-forget HTTP call ke photo-quality-service.
 * Menggunakan http module bawaan Node.js (tidak pakai fetch)
 * agar lebih reliable di semua versi Node.
 */
const http  = require('http');
const https = require('https');

const QUALITY_URL = process.env.PHOTO_QUALITY_URL || 'http://localhost:6000';

/**
 * Kirim request analisis ke photo-quality-service.
 * Langsung return tanpa menunggu response (fire-and-forget via setImmediate).
 */
function triggerQualityAnalysis({ fotoId, sesiId, objectKey, bucket }) {
  setImmediate(() => {
    _post(`${QUALITY_URL}/analyze`, {
      foto_id:    fotoId,
      sesi_id:    sesiId,
      object_key: objectKey,
      bucket:     bucket,
    });
  });
}

/**
 * HTTP POST menggunakan module http/https bawaan Node.js.
 * Tidak melempar exception ke caller — semua error di-log saja.
 */
function _post(urlStr, body) {
  let parsed;
  try { parsed = new URL(urlStr); } catch (e) {
    console.warn('[Quality] URL tidak valid:', urlStr); return;
  }

  const bodyStr = JSON.stringify(body);
  const mod     = parsed.protocol === 'https:' ? https : http;

  const req = mod.request(
    {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: 8000,
    },
    (res) => {
      // Baca dan buang response body agar socket tidak menggantung
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode === 202) {
          console.log(`[Quality] Dijadwalkan — foto_id=${body.foto_id.slice(0, 8)}…`);
        } else {
          console.warn(`[Quality] Respons ${res.statusCode} untuk foto_id=${body.foto_id.slice(0, 8)}: ${raw.slice(0, 100)}`);
        }
      });
    }
  );

  req.on('error',   (e) => console.warn(`[Quality] Koneksi gagal (${e.message}) — pastikan quality service berjalan di ${QUALITY_URL}`));
  req.on('timeout', ()  => { req.destroy(); console.warn('[Quality] Timeout — quality service tidak merespons.'); });

  req.write(bodyStr);
  req.end();
}

module.exports = { triggerQualityAnalysis };
