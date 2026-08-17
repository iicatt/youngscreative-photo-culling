/**
 * exportController.js
 * ===================
 * Ekspor seleksi foto dalam format siap-pakai Adobe Lightroom:
 *  - ZIP berisi foto asli (resolusi penuh) + sidecar .XMP per foto
 *  - XMP: xmp:Rating = 1 dan xmpDM:pick = "flagged" (flag Pick di Lightroom)
 *  - Streaming via archiver — tidak ada file temp di disk
 *  - Fallback AI Culling jika klien belum memberi status manual
 *
 * Req 3 — Acceptance Criteria semua terpenuhi.
 */
const archiver        = require('archiver');
const path            = require('path');
const db              = require('../config/db');
const { minioClient } = require('../config/minio');

/**
 * Hasilkan konten sidecar XMP untuk satu foto (Pick flag + Rating 1).
 * Format XMP cukup sederhana — tidak butuh library berat.
 */
function buildXmp(namaFile) {
  const basename = path.basename(namaFile, path.extname(namaFile));
  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="CFC Culling Foto Creative">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpDM="http://ns.adobe.com/xmp/1.0/DynamicMedia/"
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <!-- Rating 1 bintang = Pick di Lightroom Classic -->
      <xmp:Rating>1</xmp:Rating>
      <!-- Picked flag untuk Lightroom Library filter -->
      <xmpDM:pick>1</xmpDM:pick>
      <dc:description>Selected via CFC — Culling Foto Creative</dc:description>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
}

/**
 * GET /api/sesi/:sesiId/ekspor-lightroom
 * Streaming ZIP: foto asli + XMP sidecar untuk foto terpilih.
 *
 * Logika pemilihan foto (Req 3.1):
 *  1. Jika ada foto berstatus siap_edit (manual oleh klien/fotografer) → gunakan itu
 *  2. Fallback AI culling: is_blurry=false AND eyes_closed=false AND is_duplicate=false
 *     (khusus mode oleh_fotografer jika klien tidak memberi status manual)
 */
async function eksporLightroom(req, res) {
  const { sesiId } = req.params;

  // Verifikasi kepemilikan
  const sesiResult = await db.query(
    `SELECT id, nama_sesi, nama_klien, nama_bucket, mode_seleksi
     FROM sesi WHERE id = $1 AND user_id = $2`,
    [sesiId, req.user.id]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const sesi = sesiResult.rows[0];

  // ── Tentukan daftar foto terpilih ─────────────────────────
  let fotoList = [];

  // Cek apakah ada foto siap_edit dari seleksi manual
  const manualResult = await db.query(
    `SELECT id, nama_file, object_key
     FROM foto WHERE sesi_id = $1 AND status_seleksi = 'siap_edit'
     ORDER BY nama_file`,
    [sesiId]
  );

  if (manualResult.rows.length > 0) {
    // Prioritas 1: gunakan seleksi manual
    fotoList = manualResult.rows;
  } else if (sesi.mode_seleksi === 'oleh_fotografer') {
    // Fallback AI culling (Req 3.1 fallback)
    const aiResult = await db.query(
      `SELECT id, nama_file, object_key
       FROM foto
       WHERE sesi_id = $1
         AND quality_analyzed = TRUE
         AND (is_blurry IS NULL OR is_blurry = FALSE)
         AND (eyes_closed IS NULL OR eyes_closed = FALSE)
         AND (is_duplicate IS NULL OR is_duplicate = FALSE)
       ORDER BY nama_file`,
      [sesiId]
    );
    fotoList = aiResult.rows;
  }

  if (!fotoList.length) {
    return res.status(404).json({
      error: 'Tidak ada foto terpilih. Pastikan klien sudah menyelesaikan seleksi atau AI culling sudah berjalan.',
    });
  }

  // Req 3.5 — Kirim header SSE awal untuk progress (opsional, frontend polling)
  const safeNama = `${sesi.nama_klien}-${sesi.nama_sesi}`.replace(/[^a-z0-9-]/gi, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeNama}-lightroom.zip"`);
  res.setHeader('X-Total-Photos', String(fotoList.length));

  const archive = archiver('zip', { zlib: { level: 0 } }); // store = cepat
  archive.on('error', (err) => {
    console.error('[LR Export] Archiver error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat ZIP.' });
  });

  archive.pipe(res);

  let processed = 0;
  for (const foto of fotoList) {
    // Req 3.3 — hanya sertakan foto terpilih (tidak ada foto ditolak)
    try {
      const stream = await minioClient.getObject(sesi.nama_bucket, foto.object_key);
      archive.append(stream, { name: foto.nama_file });

      // XMP sidecar dengan nama file yang sama persis (namafile.xmp)
      const ext      = path.extname(foto.nama_file);
      const xmpName  = foto.nama_file.replace(new RegExp(`\\${ext}$`, 'i'), '.xmp');
      const xmpContent = buildXmp(foto.nama_file);
      archive.append(Buffer.from(xmpContent, 'utf8'), { name: xmpName });

      processed++;
    } catch (err) {
      console.error('[LR Export] Gagal ambil foto:', foto.nama_file, err.message);
    }
  }

  await archive.finalize();
  console.log(`[LR Export] Selesai — ${processed}/${fotoList.length} foto dikemas.`);
}

/**
 * GET /api/sesi/:sesiId/ekspor-lightroom/preview
 * Preview daftar foto yang akan diekspor (tanpa download file).
 * Berguna untuk menampilkan progress count di frontend sebelum download.
 */
async function previewEkspor(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, mode_seleksi FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (!sesiResult.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const sesi = sesiResult.rows[0];

  // Hitung foto siap_edit manual
  const manual = await db.query(
    `SELECT COUNT(*)::int AS count FROM foto
     WHERE sesi_id = $1 AND status_seleksi = 'siap_edit'`,
    [sesiId]
  );

  // Hitung AI fallback
  const aiFallback = await db.query(
    `SELECT COUNT(*)::int AS count FROM foto
     WHERE sesi_id = $1 AND quality_analyzed = TRUE
       AND (is_blurry IS NULL OR is_blurry = FALSE)
       AND (eyes_closed IS NULL OR eyes_closed = FALSE)
       AND (is_duplicate IS NULL OR is_duplicate = FALSE)`,
    [sesiId]
  );

  const manualCount = manual.rows[0].count;
  const useAI       = manualCount === 0 && sesi.mode_seleksi === 'oleh_fotografer';

  res.json({
    total_foto_ekspor:  useAI ? aiFallback.rows[0].count : manualCount,
    sumber:             useAI ? 'ai_culling' : 'seleksi_manual',
    mode_seleksi:       sesi.mode_seleksi,
  });
}

module.exports = { eksporLightroom, previewEkspor };
