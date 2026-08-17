/**
 * Sesi Controller — CRUD sesi/proyek fotografer
 * v3: mode_seleksi dipilih klien (nullable), fase_sesi pra/pasca-edit
 */
const { z }              = require('zod');
const { customAlphabet } = require('nanoid');
const db                 = require('../config/db');
const { ensureBucket }   = require('../config/minio');

const generateToken = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

function toBucketName(str) {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
}

// ── Schema: mode_seleksi DIHAPUS dari createSesi ─────────────
const createSesiSchema = z.object({
  nama_sesi:  z.string().min(3),
  nama_klien: z.string().min(2),
});

/**
 * POST /api/sesi
 * mode_seleksi TIDAK diisi fotografer — default NULL (klien pilih sendiri)
 */
async function createSesi(req, res) {
  const { nama_sesi, nama_klien } = createSesiSchema.parse(req.body);
  const nama_bucket = `${toBucketName(nama_klien)}-${Date.now()}`;
  const token_akses = generateToken();

  await ensureBucket(nama_bucket);

  const result = await db.query(
    `INSERT INTO sesi (user_id, nama_sesi, nama_klien, nama_bucket, token_akses)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nama_sesi, nama_klien, nama_bucket, token_akses,
               status_sesi, mode_seleksi, fase_sesi, created_at`,
    [req.user.id, nama_sesi, nama_klien, nama_bucket, token_akses]
  );

  res.status(201).json(result.rows[0]);
}

/** GET /api/sesi */
async function listSesi(req, res) {
  const result = await db.query(
    `SELECT
       s.id, s.nama_sesi, s.nama_klien, s.token_akses,
       s.status_sesi, s.mode_seleksi, s.fase_sesi, s.created_at,
       COUNT(f.id)::int AS total_foto,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'siap_edit')::int  AS siap_edit,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'ditolak')::int    AS ditolak,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'revisi')::int     AS revisi,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'belum_ditinjau')::int AS belum_ditinjau
     FROM sesi s LEFT JOIN foto f ON f.sesi_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
}

/** GET /api/sesi/:id */
async function getSesi(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `SELECT
       s.id, s.nama_sesi, s.nama_klien, s.nama_bucket, s.token_akses,
       s.status_sesi, s.mode_seleksi, s.fase_sesi, s.welcome_popup_shown, s.created_at,
       COUNT(f.id)::int AS total_foto,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'siap_edit')::int  AS siap_edit,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'ditolak')::int    AS ditolak,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'revisi')::int     AS revisi,
       COUNT(f.id) FILTER (WHERE f.status_seleksi = 'belum_ditinjau')::int AS belum_ditinjau
     FROM sesi s LEFT JOIN foto f ON f.sesi_id = s.id
     WHERE s.id = $1 AND s.user_id = $2 GROUP BY s.id`,
    [id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  res.json(result.rows[0]);
}

/** PATCH /api/sesi/:id/tutup */
async function tutupSesi(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `UPDATE sesi SET status_sesi = 'selesai' WHERE id = $1 AND user_id = $2
     RETURNING id, status_sesi`,
    [id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  res.json(result.rows[0]);
}

/**
 * PATCH /api/klien/:token/pilih-mode
 * Klien memilih mode seleksi — disimpan permanen ke DB.
 * Hanya bisa dipilih SEKALI (jika sudah ada, tolak).
 */
async function pilihModeKlien(req, res) {
  const { token } = req.params;
  const { mode_seleksi } = z.object({
    mode_seleksi: z.enum(['pilih_sendiri', 'oleh_fotografer', 'lihat_saja']),
  }).parse(req.body);

  // Cek sesi aktif
  const sesiResult = await db.query(
    `SELECT id, mode_seleksi, fase_sesi FROM sesi
     WHERE token_akses = $1 AND status_sesi = 'aktif'`,
    [token]
  );
  if (!sesiResult.rows.length) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan atau sudah berakhir.' });
  }
  const sesi = sesiResult.rows[0];

  // Fase pra_edit: lihat_saja tidak tersedia
  if (sesi.fase_sesi === 'pra_edit' && mode_seleksi === 'lihat_saja') {
    return res.status(400).json({
      error: 'Mode "Lihat-Lihat" tidak tersedia pada fase Pra-Edit.',
    });
  }

  // Mode sudah dipilih sebelumnya — permanen
  if (sesi.mode_seleksi !== null) {
    return res.status(409).json({
      error: 'Mode sudah dipilih dan tidak dapat diubah.',
      mode_seleksi: sesi.mode_seleksi,
    });
  }

  const updated = await db.query(
    `UPDATE sesi SET mode_seleksi = $1 WHERE id = $2
     RETURNING id, mode_seleksi, fase_sesi, welcome_popup_shown`,
    [mode_seleksi, sesi.id]
  );

  res.json(updated.rows[0]);
}

/**
 * PATCH /api/sesi/:id/fase-pasca-edit
 * Fotografer menandai sesi selesai diedit → fase berubah ke pasca_edit.
 */
async function tandaiSelesaiEdit(req, res) {
  const { id } = req.params;
  const result = await db.query(
    `UPDATE sesi SET fase_sesi = 'pasca_edit' WHERE id = $1 AND user_id = $2
     RETURNING id, fase_sesi`,
    [id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  res.json(result.rows[0]);
}

/**
 * PATCH /api/klien/:token/popup-shown
 * Tandai bahwa popup "terima kasih" sudah ditampilkan.
 */
async function tandaiPopupShown(req, res) {
  const { token } = req.params;
  const result = await db.query(
    `UPDATE sesi SET welcome_popup_shown = TRUE
     WHERE token_akses = $1 AND status_sesi = 'aktif'
     RETURNING id, welcome_popup_shown`,
    [token]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  res.json(result.rows[0]);
}

/** GET /api/sesi/:id/unduh-seleksi */
async function unduhSeleksi(req, res) {
  const { id } = req.params;
  const sesiCheck = await db.query(
    'SELECT id, nama_sesi, nama_klien FROM sesi WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (!sesiCheck.rows.length) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

  const fotoResult = await db.query(
    `SELECT nama_file, object_key, ukuran_file, catatan_klien
     FROM foto WHERE sesi_id = $1 AND status_seleksi = 'siap_edit' ORDER BY nama_file`,
    [id]
  );

  res.setHeader('Content-Disposition', `attachment; filename="seleksi-${id}.json"`);
  res.json({
    sesi: sesiCheck.rows[0],
    total_siap_edit: fotoResult.rows.length,
    foto: fotoResult.rows,
  });
}

module.exports = {
  createSesi, listSesi, getSesi, tutupSesi, unduhSeleksi,
  pilihModeKlien, tandaiSelesaiEdit, tandaiPopupShown,
};
