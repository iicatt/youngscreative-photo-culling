/**
 * Foto Controller — Upload massal & manajemen status seleksi
 */
const path       = require('path');
const { z }      = require('zod');
const db         = require('../config/db');
const { minioClient }          = require('../config/minio');
const { triggerQualityAnalysis } = require('../services/qualityWebhook');

// ─────────────────────────────────────────────────────────────
// UPLOAD (Fotografer)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/sesi/:sesiId/foto/upload
 * Menerima multipart/form-data, bisa banyak file sekaligus.
 * Middleware multer (memoryStorage) harus dipasang di router.
 *
 * Setelah setiap foto berhasil disimpan ke MinIO dan DB,
 * fungsi triggerQualityAnalysis dipanggil secara fire-and-forget
 * sehingga TIDAK menghambat response ke user.
 */
async function uploadFoto(req, res) {
  const { sesiId } = req.params;

  // Pastikan sesi milik fotografer yang login
  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { nama_bucket } = sesiResult.rows[0];

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
  }

  const uploaded = [];
  const failed   = [];

  for (const file of req.files) {
    const safeName   = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const object_key = `${sesiId}/${safeName}`;

    try {
      // ── Langkah 1: Upload ke MinIO ─────────────────────────
      await minioClient.putObject(
        nama_bucket,
        object_key,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );

      // ── Langkah 2: Simpan metadata ke DB ───────────────────
      const fotoResult = await db.query(
        `INSERT INTO foto (sesi_id, nama_file, object_key, ukuran_file, tipe_file)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nama_file, object_key, ukuran_file, tipe_file,
                   status_seleksi, quality_analyzed, created_at`,
        [sesiId, file.originalname, object_key, file.size, file.mimetype]
      );

      const savedFoto = fotoResult.rows[0];
      uploaded.push(savedFoto);

      // ── Langkah 3: Trigger analisis kualitas (fire-and-forget)
      // Dipanggil SETELAH upload + DB insert berhasil.
      // Tidak menunggu response — response ke user sudah dikirim lebih dulu.
      triggerQualityAnalysis({
        fotoId:    savedFoto.id,
        sesiId,
        objectKey: object_key,
        bucket:    nama_bucket,
      });

    } catch (err) {
      console.error('[Upload] Gagal:', file.originalname, err.message);
      failed.push({ nama_file: file.originalname, error: err.message });
    }
  }

  // Response dikirim sebelum analisis kualitas selesai — ini yang dimaksud fire-and-forget
  res.status(201).json({
    berhasil: uploaded.length,
    gagal:    failed.length,
    uploaded,
    failed,
  });
}

// ─────────────────────────────────────────────────────────────
// LIST & DETAIL (Fotografer dan Klien)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/sesi/:sesiId/foto
 * Daftar semua foto dalam sesi (oleh fotografer, sudah auth).
 * Menyertakan kolom kualitas agar badge bisa ditampilkan di frontend.
 */
async function listFoto(req, res) {
  const { sesiId } = req.params;

  const result = await db.query(
    `SELECT f.id, f.nama_file, f.object_key, f.ukuran_file, f.tipe_file,
            f.status_seleksi, f.catatan_klien,
            -- Kolom hasil analisis kualitas
            f.quality_analyzed,
            f.is_blurry,    f.blur_score,
            f.face_detected, f.eyes_closed, f.ear_score,
            f.is_duplicate,  f.duplicate_of,
            f.created_at
     FROM foto f
     INNER JOIN sesi s ON s.id = f.sesi_id
     WHERE f.sesi_id = $1 AND s.user_id = $2
     ORDER BY f.created_at ASC`,
    [sesiId, req.user.id]
  );

  res.json(result.rows);
}

/**
 * GET /api/klien/:token/foto
 * Daftar foto untuk klien — diakses via token, tanpa login.
 * Menyertakan kolom kualitas agar badge bisa ditampilkan di halaman klien.
 */
async function listFotoKlien(req, res) {
  const { token } = req.params;

  // Sesi boleh aktif ATAU selesai — klien tetap perlu akses untuk
  // melihat hasil edit dan mengunduh foto di fase pasca_edit
  const sesiResult = await db.query(
    `SELECT id, nama_sesi, nama_klien, nama_bucket,
            mode_seleksi, fase_sesi, welcome_popup_shown
     FROM sesi
     WHERE token_akses = $1`,
    [token]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const sesi = sesiResult.rows[0];

  const fotoResult = await db.query(
    `SELECT id, nama_file, object_key, tipe_file,
            status_seleksi, catatan_klien,
            -- Kolom kualitas untuk badge di halaman klien
            quality_analyzed,
            is_blurry, eyes_closed, is_duplicate, duplicate_of
     FROM foto
     WHERE sesi_id = $1
     ORDER BY created_at ASC`,
    [sesi.id]
  );

  res.json({ sesi, foto: fotoResult.rows });
}

// ─────────────────────────────────────────────────────────────
// SELEKSI (Klien)
// ─────────────────────────────────────────────────────────────

const seleksiSchema = z.object({
  status_seleksi: z.enum(['siap_edit', 'ditolak', 'revisi', 'belum_ditinjau']),
  catatan_klien:  z.string().max(1000).optional().nullable(),
});

/**
 * PATCH /api/klien/:token/foto/:fotoId
 * Klien menetapkan status seleksi pada sebuah foto.
 */
async function updateSeleksiKlien(req, res) {
  const { token, fotoId } = req.params;
  const { status_seleksi, catatan_klien } = seleksiSchema.parse(req.body);

  const sesiResult = await db.query(
    "SELECT id FROM sesi WHERE token_akses = $1 AND status_sesi = 'aktif'",
    [token]
  );
  if (sesiResult.rows.length === 0) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah berakhir.' });
  }
  const sesiId = sesiResult.rows[0].id;

  const result = await db.query(
    `UPDATE foto
     SET status_seleksi = $1, catatan_klien = $2
     WHERE id = $3 AND sesi_id = $4
     RETURNING id, nama_file, status_seleksi, catatan_klien, updated_at`,
    [status_seleksi, catatan_klien || null, fotoId, sesiId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Foto tidak ditemukan.' });
  }

  res.json(result.rows[0]);
}

/**
 * PATCH /api/sesi/:sesiId/foto/:fotoId/seleksi
 * Fotografer menandai status seleksi pada foto (bypass token klien)
 */
async function updateSeleksiFotografer(req, res) {
  const { sesiId, fotoId } = req.params;
  const { status_seleksi, catatan_klien } = seleksiSchema.parse(req.body);

  // Pastikan foto milik sesi milik fotografer ini
  const result = await db.query(
    `UPDATE foto SET status_seleksi = $1, catatan_klien = $2
     FROM sesi
     WHERE foto.id = $3
       AND foto.sesi_id = $4
       AND sesi.id = foto.sesi_id
       AND sesi.user_id = $5
     RETURNING foto.id, foto.nama_file, foto.status_seleksi, foto.catatan_klien`,
    [status_seleksi, catatan_klien || null, fotoId, sesiId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Foto tidak ditemukan.' });
  }
  res.json(result.rows[0]);
}

/**
 * PATCH /api/sesi/:sesiId/seleksi-massal
 * Fotografer menandai SEMUA foto dengan status tertentu sekaligus
 * Body: { foto_ids: string[], status_seleksi: string }
 */
async function seleksiMassal(req, res) {
  const { sesiId } = req.params;
  const { foto_ids, status_seleksi } = z.object({
    foto_ids: z.array(z.string().uuid()).min(1).max(500),
    status_seleksi: z.enum(['siap_edit', 'ditolak', 'revisi', 'belum_ditinjau']),
  }).parse(req.body);

  // Pastikan semua foto milik sesi ini
  const result = await db.query(
    `UPDATE foto SET status_seleksi = $1
     FROM sesi
     WHERE foto.id = ANY($2::uuid[])
       AND foto.sesi_id = $3
       AND sesi.id = foto.sesi_id
       AND sesi.user_id = $4
     RETURNING foto.id, foto.status_seleksi`,
    [status_seleksi, foto_ids, sesiId, req.user.id]
  );

  res.json({ updated: result.rows.length, status_seleksi });
}
async function deleteFoto(req, res) {
  const { sesiId, fotoId } = req.params;

  const fotoResult = await db.query(
    `SELECT f.id, f.object_key, s.nama_bucket
     FROM foto f
     INNER JOIN sesi s ON s.id = f.sesi_id
     WHERE f.id = $1 AND f.sesi_id = $2 AND s.user_id = $3`,
    [fotoId, sesiId, req.user.id]
  );
  if (fotoResult.rows.length === 0) {
    return res.status(404).json({ error: 'Foto tidak ditemukan.' });
  }
  const { object_key, nama_bucket } = fotoResult.rows[0];

  await minioClient.removeObject(nama_bucket, object_key);
  await db.query('DELETE FROM foto WHERE id = $1', [fotoId]);

  res.json({ message: 'Foto berhasil dihapus.' });
}

/**
 * GET /api/klien/:token/download-siap-edit-zip
 * ZIP streaming semua foto berstatus siap_edit.
 * Tidak perlu loop presigned URL di frontend — satu request, satu file.
 */
async function downloadZipSiapEdit(req, res) {
  const archiver = require('archiver');
  const { token } = req.params;

  const sesiResult = await db.query(
    `SELECT id, nama_sesi, nama_klien, nama_bucket, fase_sesi
     FROM sesi WHERE token_akses = $1`,
    [token]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const sesi = sesiResult.rows[0];

  // Blokir di fase pra_edit
  if (sesi.fase_sesi === 'pra_edit') {
    return res.status(403).json({
      error: 'Unduhan tidak tersedia selama fase Pra-Edit.',
      fase_sesi: sesi.fase_sesi,
    });
  }

  const fotoList = await db.query(
    `SELECT nama_file, object_key FROM foto
     WHERE sesi_id = $1 AND status_seleksi = 'siap_edit'
     ORDER BY nama_file`,
    [sesi.id]
  );

  if (!fotoList.rows.length) {
    return res.status(404).json({ error: 'Belum ada foto yang ditandai Siap Edit.' });
  }

  const safeName = `${sesi.nama_klien}-${sesi.nama_sesi}`.replace(/[^a-z0-9-]/gi, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-siap-edit.zip"`);
  res.setHeader('X-Total-Photos', String(fotoList.rows.length));

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.on('error', (err) => {
    console.error('[ZIP SiapEdit] Error:', err.message);
  });
  archive.pipe(res);

  for (const f of fotoList.rows) {
    try {
      const stream = await minioClient.getObject(sesi.nama_bucket, f.object_key);
      archive.append(stream, { name: f.nama_file });
    } catch (err) {
      console.error('[ZIP SiapEdit] Skip:', f.nama_file, err.message);
    }
  }

  await archive.finalize();
}

module.exports = {
  uploadFoto,
  listFoto,
  listFotoKlien,
  updateSeleksiKlien,
  updateSeleksiFotografer,
  seleksiMassal,
  deleteFoto,
  downloadZipSiapEdit,
};
