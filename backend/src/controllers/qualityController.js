/**
 * qualityController.js
 * ====================
 * Endpoint untuk memantau progress AI culling dan
 * me-trigger ulang analisis untuk foto tertentu.
 */
const db = require('../config/db');
const { triggerQualityAnalysis } = require('../services/qualityWebhook');

/**
 * GET /api/sesi/:sesiId/quality-status
 * Kembalikan ringkasan status analisis kualitas semua foto dalam sesi.
 * Digunakan frontend untuk polling progress bar AI culling.
 */
async function getQualityStatus(req, res) {
  const { sesiId } = req.params;

  // Pastikan sesi milik user ini
  const sesiCheck = await db.query(
    'SELECT id FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (sesiCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }

  const result = await db.query(
    `SELECT
       COUNT(*)::int                                                     AS total,
       COUNT(*) FILTER (WHERE quality_analyzed = TRUE)::int             AS selesai,
       COUNT(*) FILTER (WHERE quality_analyzed = FALSE
                           OR quality_analyzed IS NULL)::int            AS pending,
       COUNT(*) FILTER (WHERE is_blurry = TRUE)::int                    AS blurry,
       COUNT(*) FILTER (WHERE eyes_closed = TRUE
                           AND face_detected = TRUE)::int               AS eyes_closed,
       COUNT(*) FILTER (WHERE is_duplicate = TRUE)::int                 AS duplicate,
       COUNT(*) FILTER (WHERE quality_analyzed = TRUE
                           AND is_blurry = FALSE
                           AND (eyes_closed = FALSE OR face_detected = FALSE)
                           AND is_duplicate = FALSE)::int               AS ok
     FROM foto
     WHERE sesi_id = $1`,
    [sesiId]
  );

  const stats = result.rows[0];
  const persen = stats.total > 0
    ? Math.round((stats.selesai / stats.total) * 100)
    : 0;

  res.json({
    ...stats,
    persen,
    selesai_semua: stats.pending === 0 && stats.total > 0,
  });
}

/**
 * POST /api/sesi/:sesiId/quality-trigger
 * Re-trigger analisis untuk semua foto yang belum dianalisis dalam sesi.
 * Berguna jika quality-service mati saat upload terjadi.
 */
async function triggerUlang(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { nama_bucket } = sesiResult.rows[0];

  // Ambil semua foto yang belum dianalisis
  const fotoResult = await db.query(
    `SELECT id, object_key FROM foto
     WHERE sesi_id = $1
       AND (quality_analyzed = FALSE OR quality_analyzed IS NULL)`,
    [sesiId]
  );

  // Reset status ke NULL dulu agar frontend tahu sedang diproses
  if (fotoResult.rows.length > 0) {
    await db.query(
      `UPDATE foto SET quality_analyzed = FALSE
       WHERE sesi_id = $1
         AND (quality_analyzed = FALSE OR quality_analyzed IS NULL)`,
      [sesiId]
    );
  }

  // Fire-and-forget untuk setiap foto
  for (const foto of fotoResult.rows) {
    triggerQualityAnalysis({
      fotoId:    foto.id,
      sesiId,
      objectKey: foto.object_key,
      bucket:    nama_bucket,
    });
  }

  res.json({
    message:   `${fotoResult.rows.length} foto dijadwalkan ulang untuk analisis.`,
    dijadwalkan: fotoResult.rows.length,
  });
}

/**
 * POST /api/sesi/:sesiId/quality-trigger-all
 * Re-trigger SEMUA foto dalam sesi (termasuk yang sudah dianalisis).
 * Berguna untuk re-analisis ulang setelah threshold di-update.
 */
async function triggerSemua(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { nama_bucket } = sesiResult.rows[0];

  const fotoResult = await db.query(
    'SELECT id, object_key FROM foto WHERE sesi_id = $1',
    [sesiId]
  );

  // Reset semua ke pending
  await db.query(
    'UPDATE foto SET quality_analyzed = FALSE WHERE sesi_id = $1',
    [sesiId]
  );

  for (const foto of fotoResult.rows) {
    triggerQualityAnalysis({
      fotoId:    foto.id,
      sesiId,
      objectKey: foto.object_key,
      bucket:    nama_bucket,
    });
  }

  res.json({
    message:   `${fotoResult.rows.length} foto dijadwalkan untuk analisis ulang.`,
    dijadwalkan: fotoResult.rows.length,
  });
}

module.exports = { getQualityStatus, triggerUlang, triggerSemua };
