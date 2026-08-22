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
 * Menerima multipart/form-data — file di-stream dari disk temp ke MinIO.
 */
async function uploadFoto(req, res) {
  const fs = require('fs');
  const { sesiId } = req.params;

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
      // Stream dari disk langsung ke MinIO — tidak buffer ke RAM
      const fileStream = fs.createReadStream(file.path);
      const fileSize   = file.size;

      await minioClient.putObject(
        nama_bucket,
        object_key,
        fileStream,
        fileSize,
        { 'Content-Type': file.mimetype }
      );

      // Hapus file temp setelah upload
      fs.unlink(file.path, () => {});

      const fotoResult = await db.query(
        `INSERT INTO foto (sesi_id, nama_file, object_key, ukuran_file, tipe_file)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nama_file, object_key, ukuran_file, tipe_file,
                   status_seleksi, quality_analyzed, created_at`,
        [sesiId, file.originalname, object_key, fileSize, file.mimetype]
      );

      const savedFoto = fotoResult.rows[0];
      uploaded.push(savedFoto);

      // AI analysis TIDAK otomatis — fotografer trigger manual via RE-ANALYZE ALL

    } catch (err) {
      // Hapus file temp jika gagal
      try { require('fs').unlinkSync(file.path); } catch {}
      console.error('[Upload] Gagal:', file.originalname, err.message);
      failed.push({ nama_file: file.originalname, error: err.message });
    }
  }

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

/**
 * POST /api/sesi/:sesiId/foto/presign
 * Generate presigned PUT URL agar browser bisa upload langsung ke MinIO.
 * URL di-rewrite dari internal (minio:9000) ke publik (/minio-upload/)
 * Body: { files: [{ nama_file, mime_type, ukuran_file }] }
 */
async function presignUpload(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { nama_bucket } = sesiResult.rows[0];

  const { files } = z.object({
    files: z.array(z.object({
      nama_file:   z.string().min(1).max(500),
      mime_type:   z.string().regex(/^image\//),
      ukuran_file: z.number().positive(),
    })).min(1).max(100),
  }).parse(req.body);

  const EXPIRY = 3600; // 1 jam

  const result = await Promise.all(files.map(async (f) => {
    const safeName   = `${Date.now()}-${Math.random().toString(36).slice(2,7)}-${f.nama_file.replace(/\s+/g, '_')}`;
    const object_key = `${sesiId}/${safeName}`;

    // MinIO sudah dikonfigurasi MINIO_SERVER_URL = http://116.../minio-upload
    // sehingga presigned URL yang dihasilkan sudah pakai hostname publik
    const upload_url = await minioClient.presignedPutObject(
      nama_bucket, object_key, EXPIRY
    );

    return {
      object_key,
      upload_url,
      nama_file:   f.nama_file,
      mime_type:   f.mime_type,
      ukuran_file: f.ukuran_file,
      nama_bucket,
    };
  }));

  res.json({ presigned: result, expires_in: EXPIRY });
}

/**
 * POST /api/sesi/:sesiId/foto/confirm
 * Setelah browser selesai upload ke MinIO, konfirmasi ke backend
 * untuk simpan metadata ke DB dan trigger AI quality analysis.
 * Body: { uploads: [{ object_key, nama_file, mime_type, ukuran_file, nama_bucket }] }
 */
async function confirmUpload(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }

  const { uploads } = z.object({
    uploads: z.array(z.object({
      object_key:  z.string().min(1),
      nama_file:   z.string().min(1),
      mime_type:   z.string(),
      ukuran_file: z.number().positive(),
      nama_bucket: z.string().min(1),
    })).min(1).max(100),
  }).parse(req.body);

  const saved  = [];
  const failed = [];

  for (const u of uploads) {
    try {
      const fotoResult = await db.query(
        `INSERT INTO foto (sesi_id, nama_file, object_key, ukuran_file, tipe_file)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nama_file, object_key, ukuran_file, tipe_file,
                   status_seleksi, quality_analyzed, created_at`,
        [sesiId, u.nama_file, u.object_key, u.ukuran_file, u.mime_type]
      );
      const savedFoto = fotoResult.rows[0];
      saved.push(savedFoto);

      // AI analysis TIDAK otomatis — fotografer trigger manual

    } catch (err) {
      console.error('[Confirm] Gagal simpan metadata:', u.nama_file, err.message);
      failed.push({ nama_file: u.nama_file, error: err.message });
    }
  }

  res.status(201).json({
    berhasil: saved.length,
    gagal:    failed.length,
    uploaded: saved,
    failed,
  });
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
  presignUpload,
  confirmUpload,
};
