/**
 * downloadController.js
 * =====================
 * Menghasilkan presigned URL MinIO untuk download foto asli.
 * Presigned URL berlaku 15 menit — cukup untuk download tanpa
 * mengekspos kredensial MinIO ke client.
 */
const db              = require('../config/db');
const { minioClient } = require('../config/minio');

const EXPIRY_SECONDS = 15 * 60; // 15 menit

/**
 * GET /api/sesi/:sesiId/foto/:fotoId/download
 * Fotografer mendapatkan presigned URL untuk satu foto asli.
 */
async function downloadFotoAsli(req, res) {
  const { sesiId, fotoId } = req.params;

  const result = await db.query(
    `SELECT f.nama_file, f.object_key, s.nama_bucket
     FROM foto f
     INNER JOIN sesi s ON s.id = f.sesi_id
     WHERE f.id = $1 AND f.sesi_id = $2 AND s.user_id = $3`,
    [fotoId, sesiId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Foto tidak ditemukan.' });
  }

  const { nama_file, object_key, nama_bucket } = result.rows[0];

  const url = await minioClient.presignedGetObject(
    nama_bucket, object_key, EXPIRY_SECONDS,
    { 'response-content-disposition': `attachment; filename="${encodeURIComponent(nama_file)}"` }
  );

  res.json({ url, nama_file, expires_in: EXPIRY_SECONDS });
}

/**
 * GET /api/sesi/:sesiId/download-semua
 * Fotografer mendapatkan manifest JSON + presigned URL
 * untuk semua foto Siap Edit dalam sesi.
 */
async function downloadManifest(req, res) {
  const { sesiId } = req.params;
  const { status } = req.query; // optional filter: siap_edit | semua

  const sesiCheck = await db.query(
    'SELECT id, nama_sesi, nama_klien, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (sesiCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const sesi = sesiCheck.rows[0];

  const whereStatus = (status && status !== 'semua')
    ? "AND status_seleksi = $2"
    : "AND status_seleksi = 'siap_edit'";

  const params = (status && status !== 'semua')
    ? [sesiId, status]
    : [sesiId];

  const fotoResult = await db.query(
    `SELECT id, nama_file, object_key, ukuran_file, status_seleksi, catatan_klien
     FROM foto WHERE sesi_id = $1 ${whereStatus} ORDER BY nama_file`,
    params
  );

  // Buat presigned URL untuk setiap foto
  const fotoWithUrl = await Promise.all(
    fotoResult.rows.map(async (f) => {
      try {
        const url = await minioClient.presignedGetObject(
          sesi.nama_bucket, f.object_key, EXPIRY_SECONDS,
          { 'response-content-disposition': `attachment; filename="${encodeURIComponent(f.nama_file)}"` }
        );
        return { ...f, download_url: url };
      } catch {
        return { ...f, download_url: null };
      }
    })
  );

  res.json({
    sesi: { nama_sesi: sesi.nama_sesi, nama_klien: sesi.nama_klien },
    total: fotoWithUrl.length,
    expires_in: EXPIRY_SECONDS,
    foto: fotoWithUrl,
  });
}

/**
 * GET /api/klien/:token/foto/:fotoId/download
 * Klien mendownload foto asli (hanya jika sesi sudah selesai / diizinkan fotografer).
 */
async function downloadFotoKlien(req, res) {
  const { token, fotoId } = req.params;

  // Sesi boleh aktif atau selesai untuk download
  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE token_akses = $1',
    [token]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { id: sesiId, nama_bucket } = sesiResult.rows[0];

  const fotoResult = await db.query(
    'SELECT id, nama_file, object_key, status_seleksi FROM foto WHERE id = $1 AND sesi_id = $2',
    [fotoId, sesiId]
  );
  if (fotoResult.rows.length === 0) {
    return res.status(404).json({ error: 'Foto tidak ditemukan.' });
  }

  const { nama_file, object_key } = fotoResult.rows[0];

  const url = await minioClient.presignedGetObject(
    nama_bucket, object_key, EXPIRY_SECONDS,
    { 'response-content-disposition': `attachment; filename="${encodeURIComponent(nama_file)}"` }
  );

  res.json({ url, nama_file, expires_in: EXPIRY_SECONDS });
}

module.exports = { downloadFotoAsli, downloadManifest, downloadFotoKlien };
