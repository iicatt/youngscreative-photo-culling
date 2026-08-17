/**
 * hasilEditController.js
 * ======================
 * Upload berkas hasil edit, list, tanggapan klien,
 * dan streaming ZIP download semua hasil edit.
 */
const archiver        = require('archiver');
const { z }           = require('zod');
const db              = require('../config/db');
const { minioClient } = require('../config/minio');

// ── Upload hasil edit (fotografer) ───────────────────────────

/**
 * POST /api/sesi/:sesiId/hasil-edit/upload
 * Unggah file hasil edit ke MinIO prefix: {sesiId}/hasil-edit/
 * Jika ini upload pertama dan fase masih pra_edit → otomatis set pasca_edit.
 */
async function uploadHasilEdit(req, res) {
  const { sesiId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket, fase_sesi FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }
  const { nama_bucket, fase_sesi } = sesiResult.rows[0];

  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
  }

  const uploaded = [];
  const failed   = [];

  for (const file of req.files) {
    const safeName   = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const object_key = `${sesiId}/hasil-edit/${safeName}`;

    try {
      await minioClient.putObject(
        nama_bucket, object_key, file.buffer, file.size,
        { 'Content-Type': file.mimetype }
      );

      const row = await db.query(
        `INSERT INTO foto_hasil_edit
           (sesi_id, nama_file, object_key, ukuran_file, tipe_file)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nama_file, object_key, ukuran_file, tipe_file,
                   status_hasil, created_at`,
        [sesiId, file.originalname, object_key, file.size, file.mimetype]
      );
      uploaded.push(row.rows[0]);
    } catch (err) {
      console.error('[HasilEdit] Upload gagal:', file.originalname, err.message);
      failed.push({ nama_file: file.originalname, error: err.message });
    }
  }

  // Req 2.6 — jika ada yang berhasil dan fase masih pra_edit → set pasca_edit
  if (uploaded.length > 0 && fase_sesi === 'pra_edit') {
    await db.query(
      "UPDATE sesi SET fase_sesi = 'pasca_edit' WHERE id = $1",
      [sesiId]
    );
  }

  res.status(201).json({ berhasil: uploaded.length, gagal: failed.length, uploaded, failed });
}

/** GET /api/sesi/:sesiId/hasil-edit */
async function listHasilEdit(req, res) {
  const { sesiId } = req.params;

  // Verifikasi kepemilikan
  const sesiCheck = await db.query(
    'SELECT id, nama_bucket FROM sesi WHERE id = $1 AND user_id = $2',
    [sesiId, req.user.id]
  );
  if (!sesiCheck.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

  const result = await db.query(
    `SELECT id, nama_file, object_key, ukuran_file, tipe_file,
            status_hasil, catatan_hasil, foto_asli_id, created_at
     FROM foto_hasil_edit WHERE sesi_id = $1 ORDER BY created_at ASC`,
    [sesiId]
  );
  res.json(result.rows);
}

/** GET /api/klien/:token/hasil-edit — klien lihat hasil edit */
async function listHasilEditKlien(req, res) {
  const { token } = req.params;

  const sesiResult = await db.query(
    `SELECT id, nama_sesi, nama_klien, nama_bucket, fase_sesi
     FROM sesi WHERE token_akses = $1`,
    [token]
  );
  if (!sesiResult.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const sesi = sesiResult.rows[0];

  // Hanya tersedia di fase pasca_edit
  if (sesi.fase_sesi !== 'pasca_edit') {
    return res.status(403).json({
      error: 'Hasil edit belum tersedia. Fotografer masih dalam proses editing.',
      fase_sesi: sesi.fase_sesi,
    });
  }

  const result = await db.query(
    `SELECT id, nama_file, object_key, ukuran_file, tipe_file,
            status_hasil, catatan_hasil, foto_asli_id, created_at
     FROM foto_hasil_edit WHERE sesi_id = $1 ORDER BY created_at ASC`,
    [sesi.id]
  );
  res.json({ sesi, hasil_edit: result.rows });
}

/**
 * PATCH /api/klien/:token/hasil-edit/:hasilId
 * Klien memberi tanggapan pada satu berkas hasil edit.
 */
async function tanggapiHasilEdit(req, res) {
  const { token, hasilId } = req.params;
  const { status_hasil, catatan_hasil } = z.object({
    status_hasil:  z.enum(['disetujui', 'perlu_revisi']),
    catatan_hasil: z.string().max(1000).optional().nullable(),
  }).parse(req.body);

  const sesiResult = await db.query(
    "SELECT id FROM sesi WHERE token_akses = $1 AND fase_sesi = 'pasca_edit'",
    [token]
  );
  if (!sesiResult.rows.length) {
    return res.status(403).json({ error: 'Sesi tidak dalam fase pasca-edit.' });
  }

  const result = await db.query(
    `UPDATE foto_hasil_edit SET status_hasil = $1, catatan_hasil = $2
     WHERE id = $3 AND sesi_id = $4
     RETURNING id, status_hasil, catatan_hasil`,
    [status_hasil, catatan_hasil || null, hasilId, sesiResult.rows[0].id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'File tidak ditemukan.' });
  res.json(result.rows[0]);
}

/**
 * GET /api/klien/:token/hasil-edit/download-zip
 * Streaming ZIP seluruh berkas hasil edit — tanpa simpan file sementara.
 * Req 2.8: streaming via archiver pipe langsung ke response.
 */
async function downloadZipHasilEdit(req, res) {
  const { token } = req.params;

  const sesiResult = await db.query(
    `SELECT id, nama_sesi, nama_klien, nama_bucket, fase_sesi
     FROM sesi WHERE token_akses = $1`,
    [token]
  );
  if (!sesiResult.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const sesi = sesiResult.rows[0];

  if (sesi.fase_sesi !== 'pasca_edit') {
    return res.status(403).json({ error: 'Belum memasuki fase pasca-edit.' });
  }

  const hasilList = await db.query(
    'SELECT nama_file, object_key FROM foto_hasil_edit WHERE sesi_id = $1 ORDER BY created_at ASC',
    [sesi.id]
  );
  if (!hasilList.rows.length) {
    return res.status(404).json({ error: 'Belum ada berkas hasil edit.' });
  }

  const safeNama = `${sesi.nama_klien}-${sesi.nama_sesi}`.replace(/[^a-z0-9-]/gi, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeNama}-hasil-edit.zip"`);

  const archive = archiver('zip', { zlib: { level: 0 } }); // level 0 = store, paling cepat
  archive.on('error', (err) => {
    console.error('[ZIP] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Gagal membuat ZIP.' });
  });

  archive.pipe(res);

  for (const f of hasilList.rows) {
    try {
      const stream = await minioClient.getObject(sesi.nama_bucket, f.object_key);
      archive.append(stream, { name: f.nama_file });
    } catch (err) {
      console.error('[ZIP] Skip file gagal diambil:', f.nama_file, err.message);
    }
  }

  await archive.finalize();
}

/**
 * GET /api/klien/:token/foto/:fotoId/download
 * DIBLOKIR di fase pra_edit — hanya boleh di pasca_edit.
 * (Override downloadFotoKlien yang lama)
 */
async function downloadFotoKlienDenganFase(req, res) {
  const { token, fotoId } = req.params;

  const sesiResult = await db.query(
    'SELECT id, nama_bucket, fase_sesi FROM sesi WHERE token_akses = $1',
    [token]
  );
  if (!sesiResult.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const { id: sesiId, nama_bucket, fase_sesi } = sesiResult.rows[0];

  // Req 2.3 — blokir download di fase pra_edit
  if (fase_sesi === 'pra_edit') {
    return res.status(403).json({
      error: 'Unduhan foto asli tidak tersedia selama fase Pra-Edit.',
      fase_sesi,
    });
  }

  const fotoResult = await db.query(
    'SELECT nama_file, object_key FROM foto WHERE id = $1 AND sesi_id = $2',
    [fotoId, sesiId]
  );
  if (!fotoResult.rows.length) return res.status(404).json({ error: 'Foto tidak ditemukan.' });

  const { nama_file, object_key } = fotoResult.rows[0];
  const EXPIRY = 15 * 60;

  const url = await minioClient.presignedGetObject(
    nama_bucket, object_key, EXPIRY,
    { 'response-content-disposition': `attachment; filename="${encodeURIComponent(nama_file)}"` }
  );

  res.json({ url, nama_file, expires_in: EXPIRY });
}

module.exports = {
  uploadHasilEdit,
  listHasilEdit,
  listHasilEditKlien,
  tanggapiHasilEdit,
  downloadZipHasilEdit,
  downloadFotoKlienDenganFase,
};
