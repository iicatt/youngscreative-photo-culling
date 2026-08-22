const express    = require('express');
const multer     = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  createSesi, listSesi, getSesi, tutupSesi, unduhSeleksi,
  tandaiSelesaiEdit,
} = require('../controllers/sesiController');
const {
  uploadFoto, listFoto, deleteFoto,
  updateSeleksiFotografer, seleksiMassal,
  presignUpload, confirmUpload,
} = require('../controllers/fotoController');
const {
  uploadHasilEdit, listHasilEdit,
} = require('../controllers/hasilEditController');
const {
  downloadFotoAsli, downloadManifest,
} = require('../controllers/downloadController');
const {
  eksporLightroom, previewEkspor,
} = require('../controllers/exportController');
const qualityCtrl = require('../controllers/qualityController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB per file
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\//;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan.'));
  },
});

router.use(authenticate);

// ── Sesi CRUD ─────────────────────────────────────────────────
router.get('/',                   listSesi);
router.post('/',                  createSesi);
router.get('/:id',                getSesi);
router.patch('/:id/tutup',        tutupSesi);
router.get('/:id/unduh-seleksi',  unduhSeleksi);

// ── Fase edit ─────────────────────────────────────────────────
// Fotografer tandai sesi selesai diedit → fase pasca_edit
router.patch('/:id/selesai-edit', tandaiSelesaiEdit);

// ── Quality AI Culling ────────────────────────────────────────
router.get('/:sesiId/quality-status',       qualityCtrl.getQualityStatus);
router.post('/:sesiId/quality-trigger',     qualityCtrl.triggerUlang);
router.post('/:sesiId/quality-trigger-all', qualityCtrl.triggerSemua);

// ── Foto asli dalam sesi ──────────────────────────────────────
router.get('/:sesiId/foto',                    listFoto);
router.post('/:sesiId/foto/presign',           presignUpload);   // generate presigned PUT URL
router.post('/:sesiId/foto/confirm',           confirmUpload);   // simpan metadata setelah upload
router.post('/:sesiId/foto/upload',            upload.array('foto', 100), uploadFoto); // fallback
router.delete('/:sesiId/foto/:fotoId',         deleteFoto);
router.patch('/:sesiId/foto/:fotoId/seleksi',  updateSeleksiFotografer);
router.patch('/:sesiId/seleksi-massal',        seleksiMassal);

// ── Download foto asli (presigned URL, fotografer) ────────────
router.get('/:sesiId/foto/:fotoId/download',   downloadFotoAsli);
router.get('/:sesiId/download-semua',          downloadManifest);

// ── Hasil Edit (fotografer upload + list) ─────────────────────
router.get('/:sesiId/hasil-edit',              listHasilEdit);
router.post('/:sesiId/hasil-edit/upload',      upload.array('hasil', 100), uploadHasilEdit);

// ── Ekspor Lightroom ──────────────────────────────────────────
router.get('/:sesiId/ekspor-lightroom/preview', previewEkspor);
router.get('/:sesiId/ekspor-lightroom',         eksporLightroom);

module.exports = router;
