/**
 * FasePanel.jsx
 * =============
 * Panel fase pra/pasca-edit + upload hasil edit + ekspor Lightroom.
 * Ditampilkan di SesiDetailPage.
 */
import { useState, useCallback } from 'react';
import { useDropzone }    from 'react-dropzone';
import { useQuery }       from '@tanstack/react-query';
import toast              from 'react-hot-toast';
import Spinner            from '../common/Spinner';
import api                from '../../services/api';

export default function FasePanel({ sesiId, sesi, onFaseChanged }) {
  const [open,            setOpen]            = useState(true);
  const [uploadingHasil,  setUploadingHasil]  = useState(false);
  const [hasilQueue,      setHasilQueue]      = useState([]);
  const [eksporLoading,   setEksporLoading]   = useState(false);
  const [tandaiLoading,   setTandaiLoading]   = useState(false);

  const isPraEdit   = sesi?.fase_sesi === 'pra_edit' || !sesi?.fase_sesi;
  const isPascaEdit = sesi?.fase_sesi === 'pasca_edit';

  // Preview ekspor Lightroom
  const { data: preview } = useQuery({
    queryKey: ['ekspor-preview', sesiId],
    queryFn:  () => api.get(`/sesi/${sesiId}/ekspor-lightroom/preview`).then((r) => r.data),
    enabled:  !!sesiId,
    staleTime: 30000,
  });

  // Dropzone untuk upload hasil edit
  const onDrop = useCallback((accepted) => {
    setHasilQueue((p) => [...p, ...accepted]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.tiff'] },
    multiple: true,
    maxSize: 200 * 1024 * 1024,
  });

  async function uploadHasil() {
    if (!hasilQueue.length) return;
    setUploadingHasil(true);
    const form = new FormData();
    hasilQueue.forEach((f) => form.append('hasil', f));
    try {
      const { data } = await api.post(`/sesi/${sesiId}/hasil-edit/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`${data.berhasil} berkas hasil edit diunggah.`);
      setHasilQueue([]);
      onFaseChanged?.(); // refresh sesi untuk update fase_sesi
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload gagal.');
    } finally {
      setUploadingHasil(false);
    }
  }

  async function tandaiSelesaiEdit() {
    if (!window.confirm('Tandai sesi ini sebagai Selesai Edit? Klien akan bisa melihat dan mengunduh hasil akhir.')) return;
    setTandaiLoading(true);
    try {
      await api.patch(`/sesi/${sesiId}/selesai-edit`);
      toast.success('Sesi masuk fase Pasca-Edit. Klien sekarang bisa mengakses hasil edit.');
      onFaseChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengubah fase.');
    } finally {
      setTandaiLoading(false);
    }
  }

  async function eksporLightroom() {
    setEksporLoading(true);
    try {
      toast('Menyusun ZIP Lightroom…', { icon: '📦', duration: 8000 });
      const resp = await fetch(`/api/sesi/${sesiId}/ekspor-lightroom`, {
        headers: {
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('yc-auth'))?.state?.token}`,
        },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Gagal ekspor.');
        return;
      }
      const blob      = await resp.blob();
      const totalHdr  = resp.headers.get('X-Total-Photos');
      const url       = URL.createObjectURL(blob);
      const a         = document.createElement('a');
      a.href          = url;
      a.download      = `${sesi?.nama_klien || 'export'}-lightroom.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP Lightroom siap! ${totalHdr ? `(${totalHdr} foto)` : ''}`);
    } catch {
      toast.error('Gagal mengunduh ZIP Lightroom.');
    } finally {
      setEksporLoading(false);
    }
  }

  return (
    <div className="card overflow-hidden">

      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3
                   hover:bg-surface-container-high transition-colors border-b border-border-dark"
        onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0
            ${isPascaEdit ? 'bg-success/20' : 'bg-outline-variant/30'}`}>
            <span className={`material-symbols-outlined ${isPascaEdit ? 'text-success' : 'text-on-surface-variant'}`}
                  style={{fontSize:14, fontVariationSettings: isPascaEdit ? "'FILL' 1" : "'FILL' 0"}}>
              {isPascaEdit ? 'task_alt' : 'pending_actions'}
            </span>
          </div>
          <div className="text-left">
            <p className="text-label-sm font-label-sm text-text-primary uppercase tracking-wider">
              Fase Sesi
            </p>
            <p className="text-mono-label font-mono-label text-text-muted mt-0.5">
              {isPraEdit
                ? 'Pra-Edit — klien sedang memilih foto'
                : 'Pasca-Edit — hasil edit tersedia untuk klien'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`chip ${isPascaEdit ? 'chip-green' : 'chip-orange'}`}>
            {isPascaEdit ? 'Pasca-Edit' : 'Pra-Edit'}
          </span>
          <span className="material-symbols-outlined text-text-muted" style={{fontSize:16}}>
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 flex flex-col gap-5">

          {/* ── Info mode klien ──────────────────────────────── */}
          <div className="flex items-start gap-3 p-3 bg-surface-container rounded border border-border-dark">
            <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-0.5"
                  style={{fontSize:16}}>person</span>
            <div>
              <p className="text-label-sm font-label-sm text-text-muted uppercase tracking-widest mb-1">
                Mode Klien
              </p>
              {sesi?.mode_seleksi ? (
                <p className="text-body-md font-body-md text-text-primary">
                  {{
                    pilih_sendiri:   'Pilih Sendiri — klien memilih foto secara mandiri',
                    oleh_fotografer: "Sudah Dipilihkan — klien menyetujui pilihan fotografer",
                    lihat_saja:      'Lihat-Lihat — read-only',
                  }[sesi.mode_seleksi] || sesi.mode_seleksi}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  <p className="text-body-md font-body-md text-yellow-400">
                    Menunggu klien memilih mode
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Upload Hasil Edit ─────────────────────────────── */}
          <div>
            <p className="text-label-sm font-label-sm text-text-muted uppercase tracking-widest mb-3">
              Upload Hasil Edit Final
            </p>
            <div
              {...getRootProps()}
              className={`border border-dashed rounded p-6 text-center cursor-pointer transition-colors
                ${isDragActive
                  ? 'border-primary-container bg-primary-container/10'
                  : 'border-border-dark hover:border-outline bg-surface-container-low'}`}>
              <input {...getInputProps()} />
              <span className={`material-symbols-outlined block mb-2 mx-auto
                ${isDragActive ? 'text-primary-container' : 'text-text-muted'}`}
                    style={{fontSize:32}}>drive_folder_upload</span>
              <p className="text-body-md font-body-md text-text-primary font-medium">
                {isDragActive ? 'Lepas file di sini…' : 'Drag foto hasil edit, atau klik'}
              </p>
              <p className="text-mono-label font-mono-label text-text-muted mt-1">
                JPG · PNG · WebP · TIFF — maks. 200 MB/file
              </p>
            </div>

            {hasilQueue.length > 0 && (
              <div className="mt-2 card p-3 max-h-32 overflow-y-auto">
                {hasilQueue.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-border-dark
                                          last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
                    <span className="text-mono-label font-mono-label text-text-primary truncate flex-1">
                      {f.name}
                    </span>
                    <span className="text-mono-label font-mono-label text-text-muted shrink-0">
                      {(f.size/1024/1024).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hasilQueue.length > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={uploadHasil} disabled={uploadingHasil}
                  className="btn-primary text-xs py-2">
                  {uploadingHasil
                    ? <><Spinner size={12}/> Uploading…</>
                    : <><span className="material-symbols-outlined" style={{fontSize:14}}>
                        upload</span> Upload {hasilQueue.length} file</>
                  }
                </button>
                <button onClick={() => setHasilQueue([])} disabled={uploadingHasil}
                  className="btn-secondary text-xs py-2">Clear</button>
              </div>
            )}
          </div>

          {/* ── Tandai Selesai Edit ───────────────────────────── */}
          {isPraEdit && (
            <div className="card p-4 border-outline-variant">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-0.5"
                      style={{fontSize:18}}>edit_note</span>
                <div className="flex-1">
                  <p className="text-label-sm font-label-sm text-text-primary uppercase tracking-wider mb-1">
                    Tandai Selesai Edit
                  </p>
                  <p className="text-mono-label font-mono-label text-text-muted mb-3">
                    Upload hasil edit di atas, lalu klik tombol ini untuk memberi tahu klien bahwa
                    foto sudah selesai diedit dan siap diunduh.
                  </p>
                  <button onClick={tandaiSelesaiEdit} disabled={tandaiLoading}
                    className="btn-primary text-xs py-2">
                    {tandaiLoading
                      ? <><Spinner size={12}/> Memproses…</>
                      : <><span className="material-symbols-outlined" style={{fontSize:14}}>
                          task_alt</span> Tandai Selesai Edit</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Ekspor Lightroom ──────────────────────────────── */}
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-surface-container-high rounded flex items-center
                              justify-center shrink-0 mt-0.5">
                <span className="text-mono-label font-mono-label font-bold text-on-surface-variant"
                      style={{fontSize:10}}>Lr</span>
              </div>
              <div className="flex-1">
                <p className="text-label-sm font-label-sm text-text-primary uppercase tracking-wider mb-1">
                  Ekspor untuk Adobe Lightroom
                </p>
                <p className="text-mono-label font-mono-label text-text-muted mb-2">
                  ZIP berisi foto asli + sidecar .XMP. Import ke Lightroom → foto terpilih
                  otomatis tampil dengan flag Pick (★).
                </p>

                {/* Preview info */}
                {preview && (
                  <div className="flex items-center gap-3 mb-3 text-mono-label font-mono-label">
                    <span className="text-text-primary font-medium">
                      {preview.total_foto_ekspor} foto akan diekspor
                    </span>
                    <span className="chip">
                      {preview.sumber === 'ai_culling' ? 'AI Fallback' : 'Seleksi Manual'}
                    </span>
                  </div>
                )}

                <button onClick={eksporLightroom} disabled={eksporLoading}
                  className="btn-secondary text-xs py-2">
                  {eksporLoading
                    ? <><Spinner size={12}/> Menyusun ZIP…</>
                    : <><span className="material-symbols-outlined" style={{fontSize:14}}>
                        file_download</span> Ekspor Lightroom (.zip + .xmp)</>
                  }
                </button>

                {eksporLoading && (
                  <p className="text-mono-label font-mono-label text-text-muted mt-2 animate-pulse">
                    Mengemas foto dari MinIO — harap tunggu…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
