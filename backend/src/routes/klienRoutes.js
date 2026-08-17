const express = require('express');
const {
  listFotoKlien,
  updateSeleksiKlien,
  downloadZipSiapEdit,
} = require('../controllers/fotoController');
const {
  pilihModeKlien,
  tandaiPopupShown,
} = require('../controllers/sesiController');
const {
  listHasilEditKlien,
  tanggapiHasilEdit,
  downloadZipHasilEdit,
  downloadFotoKlienDenganFase,
} = require('../controllers/hasilEditController');

const router = express.Router();

// ── Info sesi + foto ──────────────────────────────────────────
router.get('/:token/foto',                   listFotoKlien);
router.patch('/:token/foto/:fotoId',         updateSeleksiKlien);

// ── ZIP download foto siap edit (satu file, tidak loop) ───────
router.get('/:token/download-siap-edit-zip', downloadZipSiapEdit);

// ── Mode seleksi (Req 1) ──────────────────────────────────────
// Klien memilih mode — disimpan permanen ke DB
router.patch('/:token/pilih-mode',           pilihModeKlien);

// ── Popup flag (Req 2.4) ──────────────────────────────────────
router.patch('/:token/popup-shown',          tandaiPopupShown);

// ── Download foto asli — diblokir di pra_edit (Req 2.3) ───────
router.get('/:token/foto/:fotoId/download',  downloadFotoKlienDenganFase);

// ── Hasil Edit (Req 2.7) ──────────────────────────────────────
router.get('/:token/hasil-edit',               listHasilEditKlien);
// PENTING: download-zip HARUS sebelum /:hasilId agar Express tidak
// salah cocokkan "download-zip" sebagai nilai :hasilId
router.get('/:token/hasil-edit/download-zip',  downloadZipHasilEdit);
router.patch('/:token/hasil-edit/:hasilId',    tanggapiHasilEdit);

module.exports = router;
