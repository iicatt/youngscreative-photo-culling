/**
 * KlienPage.jsx — v3
 * Req 1: mode dari DB (bukan sessionStorage), permanen
 * Req 2.3: sembunyikan download di pra_edit
 * Req 2.4: popup sekali untuk mode oleh_fotografer
 * Req 2.7: tab Hasil Edit di pasca_edit
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast                    from 'react-hot-toast';
import Spinner          from '../components/common/Spinner';
import StatusBadge      from '../components/common/StatusBadge';
import QualityBadges    from '../components/common/QualityBadges';
import { proxyUrl }     from '../services/proxyUrl';
import api              from '../services/api';

const MODE_LABEL = {
  pilih_sendiri:   'Full Selection',
  oleh_fotografer: "Curator's Pick",
  lihat_saja:      'View Only',
};

const FILTERS_FULL = [
  { key: 'semua',          label: 'All' },
  { key: 'belum_ditinjau', label: 'Unreviewed' },
  { key: 'siap_edit',      label: 'Ready' },
  { key: 'revisi',         label: 'Revision' },
  { key: 'ditolak',        label: 'Rejected' },
];
const FILTERS_FOTO = [
  { key: 'semua',     label: "Photographer's Pick" },
  { key: 'siap_edit', label: 'Ready' },
  { key: 'revisi',    label: 'Needs Review' },
];

// ── Popup "Terima Kasih" (Req 2.4) ───────────────────────────
function ThankyouPopup({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full p-8 text-center animate-[fadeIn_0.3s_ease]">
        <span className="material-symbols-outlined text-primary-container block mb-4"
              style={{fontSize:52, fontVariationSettings:"'FILL' 1"}}>
          favorite
        </span>
        <h2 className="text-headline-md font-headline-md text-text-primary mb-3">
          Terima kasih telah mempercayai kami!
        </h2>
        <p className="text-body-md font-body-md text-on-surface-variant mb-6">
          Fotografer Anda telah memilih foto terbaik untuk diedit.
          Tinjau pilihan mereka dan berikan persetujuan Anda.
        </p>
        <button className="btn-primary w-full justify-center py-3" onClick={onClose}>
          Lihat Pilihan Fotografer
        </button>
      </div>
    </div>
  );
}

// ── Tab Hasil Edit (Req 2.7) ──────────────────────────────────
function HasilEditTab({ token, sesi }) {
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hasil-edit', token],
    queryFn:  () => api.get(`/klien/${token}/hasil-edit`).then((r) => r.data),
    retry: false,
  });

  const tanggapiMut = useMutation({
    mutationFn: ({ hasilId, status, catatan }) =>
      api.patch(`/klien/${token}/hasil-edit/${hasilId}`, {
        status_hasil: status, catatan_hasil: catatan,
      }),
    onSuccess: () => {
      toast.success('Tanggapan disimpan.');
    },
    onError: () => toast.error('Gagal menyimpan tanggapan.'),
  });

  async function handleDownloadZip() {
    setDownloading(true);
    try {
      const resp = await fetch(`/api/klien/${token}/hasil-edit/download-zip`);
      if (!resp.ok) { toast.error('Gagal mengunduh ZIP.'); return; }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${sesi.nama_klien}-hasil-edit.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP berhasil diunduh.');
    } catch { toast.error('Gagal mengunduh.'); }
    finally { setDownloading(false); }
  }

  if (isLoading) return (
    <div className="flex justify-center py-12"><Spinner size={28} /></div>
  );

  const hasil = data?.hasil_edit || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header + Download ZIP */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-headline-md font-headline-md text-text-primary">
            Hasil Editan Final
          </h2>
          <p className="text-mono-label font-mono-label text-on-surface-variant mt-0.5">
            {hasil.length} berkas tersedia
          </p>
        </div>
        {hasil.length > 0 && (
          <button onClick={handleDownloadZip} disabled={downloading}
            className="btn-primary">
            {downloading
              ? <><Spinner size={14}/> Menyiapkan ZIP…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>
                  download_for_offline</span> Unduh Semua (ZIP)</>
            }
          </button>
        )}
      </div>

      {hasil.length === 0 ? (
        <div className="card p-12 text-center text-on-surface-variant text-body-md font-body-md">
          Berkas hasil edit belum tersedia.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {hasil.map((h) => (
            <HasilEditCard key={h.id} item={h} token={token} sesi={sesi}
              onTanggapi={(status, catatan) =>
                tanggapiMut.mutate({ hasilId: h.id, status, catatan })} />
          ))}
        </div>
      )}
    </div>
  );
}

function HasilEditCard({ item, token, sesi, onTanggapi }) {
  const [catatan, setCatatan] = useState(item.catatan_hasil || '');
  const [open,    setOpen]    = useState(false);

  const STATUS_CLS = {
    menunggu:      'chip',
    disetujui:     'chip chip-green',
    perlu_revisi:  'chip chip-yellow',
  };

  return (
    <div className="card overflow-hidden flex flex-col group">
      {/* Preview thumbnail via image proxy */}
      <div className="aspect-square bg-surface-container-lowest overflow-hidden relative">
        <img
          src={proxyUrl(sesi.nama_bucket, item.object_key, { preset: 'thumb', wm: false })}
          alt={item.nama_file}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent
                        p-2">
          <span className={STATUS_CLS[item.status_hasil] || 'chip'}>
            {item.status_hasil === 'menunggu' ? 'Menunggu'
             : item.status_hasil === 'disetujui' ? 'Disetujui'
             : 'Perlu Revisi'}
          </span>
        </div>
      </div>

      {/* Info + tombol tanggapi */}
      <div className="p-2 flex flex-col gap-1.5 bg-surface-dark flex-1">
        <p className="text-mono-label font-mono-label text-text-muted truncate"
           title={item.nama_file}>{item.nama_file}</p>
        <button onClick={() => setOpen(!open)}
          className="text-mono-label font-mono-label text-primary-container
                     hover:underline text-left">
          {open ? 'Tutup' : 'Beri Tanggapan'}
        </button>
        {open && (
          <div className="flex flex-col gap-1.5 pt-1">
            <textarea
              className="bg-surface-dim border border-border-dark rounded p-2 text-xs
                         text-text-primary resize-none focus:outline-none focus:border-primary-container"
              rows={2}
              placeholder="Catatan (opsional)…"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={500}
            />
            <div className="flex gap-1.5">
              <button onClick={() => onTanggapi('disetujui', catatan)}
                className="flex-1 py-1 bg-success/20 border border-success/40 text-success
                           text-mono-label font-mono-label rounded hover:bg-success/30 transition-colors">
                Setuju
              </button>
              <button onClick={() => onTanggapi('perlu_revisi', catatan)}
                className="flex-1 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400
                           text-mono-label font-mono-label rounded hover:bg-yellow-500/30 transition-colors">
                Revisi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function KlienPage() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [filter,      setFilter]      = useState('semua');
  const [downloading, setDownloading] = useState(false);
  const [activeTab,   setActiveTab]   = useState('seleksi'); // 'seleksi' | 'hasil'
  const [showPopup,   setShowPopup]   = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['klien', token],
    queryFn:  () => api.get(`/klien/${token}/foto`).then((r) => r.data),
    retry: false,
    staleTime: 0,              // selalu fetch ulang — fase bisa berubah kapan saja
    refetchOnWindowFocus: true, // refetch otomatis saat klien kembali ke tab
    refetchInterval: ({ state }) => {
      const list = state.data?.foto;
      if (!list) return false;
      // Juga polling jika masih pra_edit (menunggu fotografer selesai edit)
      const ada_pending_ai = list.some((f) => !f.quality_analyzed);
      const masih_pra      = state.data?.sesi?.fase_sesi === 'pra_edit';
      return (ada_pending_ai || masih_pra) ? 10000 : false;
    },
  });

  // Req 2.4 — popup sekali untuk mode oleh_fotografer
  useEffect(() => {
    if (!data?.sesi) return;
    const sesi = data.sesi;
    if (sesi.mode_seleksi === 'oleh_fotografer' && !sesi.welcome_popup_shown) {
      setShowPopup(true);
    }
  }, [data]);

  async function handleClosePopup() {
    setShowPopup(false);
    try { await api.patch(`/klien/${token}/popup-shown`); } catch { /* silent */ }
  }

  async function downloadSiapEdit() {
    setDownloading(true);
    try {
      // Gunakan ZIP streaming — satu request, satu file, tidak perlu popup/tab baru
      // Browser tidak bisa blokir ini karena dipanggil langsung dari klik user
      const resp = await fetch(`/api/klien/${token}/download-siap-edit-zip`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Gagal mengunduh.');
        return;
      }
      const blob     = await resp.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `${data.sesi.nama_klien}-seleksi.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const total = resp.headers.get('X-Total-Photos');
      toast.success(`${total || ''} foto berhasil diunduh.`);
    } catch (err) {
      toast.error('Gagal mengunduh.');
    } finally { setDownloading(false); }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size={32} />
    </div>
  );
  if (isError || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card p-8 text-center max-w-sm">
        <span className="material-symbols-outlined text-text-muted block mb-3"
              style={{fontSize:40}}>broken_image</span>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-text-primary">
          Sesi tidak ditemukan
        </h1>
      </div>
    </div>
  );

  const { sesi, foto } = data;
  const mode        = sesi.mode_seleksi || 'pilih_sendiri';
  const isPraEdit   = sesi.fase_sesi === 'pra_edit' || !sesi.fase_sesi;
  const isPascaEdit = sesi.fase_sesi === 'pasca_edit';
  const isLihatSaja = mode === 'lihat_saja';
  const bisaSeleksi = mode === 'pilih_sendiri';

  const baseFoto      = mode === 'oleh_fotografer'
    ? foto.filter((f) => f.status_seleksi !== 'belum_ditinjau')
    : foto;
  const statusFilters = mode === 'oleh_fotografer' ? FILTERS_FOTO : FILTERS_FULL;
  const displayedFoto = filter === 'semua' ? baseFoto
    : baseFoto.filter((f) => f.status_seleksi === filter);
  const totalSudah    = foto.filter((f) => f.status_seleksi !== 'belum_ditinjau').length;
  const progres       = foto.length > 0 ? Math.round((totalSudah / foto.length) * 100) : 0;
  const siapEditCount = foto.filter((f) => f.status_seleksi === 'siap_edit').length;

  return (
    <div className="min-h-screen bg-background">

      {/* Popup oleh_fotografer (sekali saja) */}
      {showPopup && <ThankyouPopup onClose={handleClosePopup} />}

      {/* Top nav */}
      <nav className="bg-surface border-b border-border-dark px-4 md:px-6 h-16
                      flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/k/${token}`)}
            className="text-on-surface-variant hover:text-primary transition-colors"
            aria-label="Back">
            <span className="material-symbols-outlined" style={{fontSize:20}}>arrow_back</span>
          </button>
          <div>
            <span className="text-headline-md font-headline-md text-text-primary block leading-tight">
              {sesi.nama_sesi}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-mono-label font-mono-label text-on-surface-variant">
                {sesi.nama_klien}
              </span>
              <span className="text-border-dark">·</span>
              <span className="text-mono-label font-mono-label text-on-surface-variant">
                {MODE_LABEL[mode] || mode}
              </span>
              {/* Fase badge */}
              <span className={`chip ml-1 ${isPraEdit ? 'chip-orange' : 'chip-green'}`}>
                {isPraEdit ? 'Pra-Edit' : 'Pasca-Edit'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tidak ada tombol download di tab seleksi —
              download hanya tersedia di tab Hasil Edit Final */}
        </div>
      </nav>

      {/* Tab bar — hanya tampil jika pasca_edit */}
      {isPascaEdit && (
        <div className="bg-surface border-b border-border-dark px-4 md:px-6 flex gap-0">
          {[
            { key: 'seleksi', label: 'Seleksi Foto', icon: 'photo_library' },
            { key: 'hasil',   label: 'Hasil Edit Final', icon: 'auto_fix_high' },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-label-sm font-label-sm
                          uppercase tracking-wider transition-colors
                ${activeTab === key
                  ? 'border-primary-container text-primary-container'
                  : 'border-transparent text-on-surface-variant hover:text-text-primary'
                }`}>
              <span className="material-symbols-outlined" style={{fontSize:16}}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-col gap-4">

        {/* ── Tab Hasil Edit ─────────────────────────────────── */}
        {activeTab === 'hasil' && isPascaEdit && (
          <>
            {/* Tombol unduh foto asli seleksi — hanya di sini, bukan di tab Seleksi */}
            {siapEditCount > 0 && !isLihatSaja && (
              <div className="card p-4 flex items-center justify-between gap-4 flex-wrap
                              border-primary-container/30">
                <div>
                  <p className="text-label-sm font-label-sm text-primary-container uppercase tracking-wider">
                    Foto Seleksi Asli ({siapEditCount} foto)
                  </p>
                  <p className="text-mono-label font-mono-label text-text-muted mt-0.5">
                    Unduh foto resolusi penuh yang telah dipilih dari sesi ini.
                  </p>
                </div>
                <button onClick={downloadSiapEdit} disabled={downloading}
                  className="btn-secondary shrink-0 text-xs">
                  {downloading
                    ? <><Spinner size={12}/> Menyiapkan…</>
                    : <><span className="material-symbols-outlined" style={{fontSize:14}}>
                        download</span> Unduh Foto Asli Seleksi</>
                  }
                </button>
              </div>
            )}
            <HasilEditTab token={token} sesi={sesi} />
          </>
        )}

        {/* ── Tab Seleksi ────────────────────────────────────── */}
        {activeTab === 'seleksi' && (
          <>
            {/* Banner pra_edit info */}
            {isPraEdit && (
              <div className="card p-3 flex items-center gap-3 border-outline-variant">
                <span className="material-symbols-outlined text-on-surface-variant shrink-0"
                      style={{fontSize:16}}>info</span>
                <p className="text-body-md font-body-md text-on-surface-variant flex-1">
                  Fase Pra-Edit — Pilih foto yang ingin Anda edit.
                  Unduhan tersedia setelah fotografer selesai mengedit.
                </p>
              </div>
            )}

            {/* View-only banner */}
            {isLihatSaja && (
              <div className="card p-3 flex items-center gap-3 border-outline-variant">
                <span className="material-symbols-outlined text-on-surface-variant shrink-0"
                      style={{fontSize:16}}>visibility</span>
                <p className="text-body-md font-body-md text-on-surface-variant flex-1">
                  Mode View Only — Anda sedang melihat tanpa memilih.
                </p>
                <button onClick={() => navigate(`/k/${token}`)}
                  className="text-mono-label font-mono-label text-primary-container
                             underline shrink-0">Ganti Mode</button>
              </div>
            )}

            {/* Progress bar (pilih_sendiri) */}
            {bisaSeleksi && foto.length > 0 && (
              <div className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">
                    Progress Seleksi
                  </span>
                  <span className="text-label-sm font-label-sm text-text-primary">{progres}%</span>
                </div>
                <div className="h-[2px] bg-surface-container-highest w-full overflow-hidden">
                  <div className="h-full bg-primary-container transition-all duration-700"
                       style={{ width: `${progres}%` }} />
                </div>
                <p className="text-mono-label font-mono-label text-text-muted mt-2">
                  {totalSudah} dari {foto.length} foto ditinjau
                </p>
              </div>
            )}

            {/* Download banner — DIHAPUS dari tab Seleksi.
                Download hanya tersedia di tab "Hasil Edit Final" setelah fotografer selesai edit. */}

            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map(({ key, label }) => {
                const count = key === 'semua' ? baseFoto.length
                  : baseFoto.filter((p) => p.status_seleksi === key).length;
                return (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-[2px] border text-label-sm font-label-sm
                                uppercase tracking-wider transition-colors
                      ${filter === key
                        ? 'bg-primary-container/20 border-primary-container text-primary-container'
                        : 'border-border-dark text-on-surface-variant hover:bg-surface-container-high'
                      }`}>
                    {label}
                    {key !== 'semua' && (
                      <span className="ml-1.5 text-mono-label font-mono-label opacity-60">
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Photo grid */}
            {displayedFoto.length === 0 ? (
              <div className="card p-12 text-center text-on-surface-variant text-body-md font-body-md">
                Tidak ada foto dalam kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayedFoto.map((f, idx) => {
                  const inner = (
                    <>
                      <div className="aspect-square bg-surface-container-lowest overflow-hidden relative">
                        <img
                          src={proxyUrl(sesi.nama_bucket, f.object_key,
                            { preset: 'thumb', wm: true })}
                          alt={f.nama_file}
                          loading={idx < 12 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105
                                     transition-transform duration-300"
                        />
                        {f.status_seleksi === 'siap_edit' && (
                          <div className="absolute inset-0 ring-inset ring-2 ring-success/50 bg-success/5"/>
                        )}
                        {f.status_seleksi === 'ditolak' && (
                          <div className="absolute inset-0 ring-inset ring-2 ring-error/50 bg-error/5"/>
                        )}
                        {f.status_seleksi === 'revisi' && (
                          <div className="absolute inset-0 ring-inset ring-2 ring-yellow-500/50 bg-yellow-500/5"/>
                        )}
                        {isLihatSaja && (
                          <div className="absolute top-1.5 right-1.5 bg-surface-dim/70 rounded-full p-1">
                            <span className="material-symbols-outlined text-text-muted"
                                  style={{fontSize:10}}>lock</span>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5 bg-surface-dark flex flex-col gap-0.5">
                        <StatusBadge status={f.status_seleksi} />
                        <QualityBadges foto={f} size="sm" showAnalyzing={false} />
                      </div>
                    </>
                  );

                  return !isLihatSaja ? (
                    <Link key={f.id} to={`/k/${token}/foto/${f.id}`}
                      className="rounded border border-border-dark overflow-hidden group
                                 hover:border-primary-container hover:shadow-lg
                                 hover:shadow-black/40 transition-all duration-200"
                      aria-label={`Tinjau ${f.nama_file}`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={f.id}
                      className="rounded border border-border-dark overflow-hidden group cursor-default">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
