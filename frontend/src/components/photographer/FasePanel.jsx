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
  const [uploadProgress,  setUploadProgress]  = useState({}); // { filename: pct }
  const [uploadDone,      setUploadDone]      = useState({}); // { filename: true/false }
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
    maxSize: 2 * 1024 * 1024 * 1024, // 2 GB per file
  });

  async function uploadHasil() {
    if (!hasilQueue.length) return;
    setUploadingHasil(true);
    setUploadProgress({});
    setUploadDone({});

    const token = JSON.parse(localStorage.getItem('yc-auth'))?.state?.token;
    let berhasil = 0;
    let gagal    = 0;

    const CONCURRENT = 3;
    for (let i = 0; i < hasilQueue.length; i += CONCURRENT) {
      const batch = hasilQueue.slice(i, i + CONCURRENT);
      await Promise.all(batch.map((file) => new Promise((resolve) => {
        const form = new FormData();
        form.append('hasil', file);

        const xhr = new XMLHttpRequest();

        // Progress per file
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const d = JSON.parse(xhr.responseText);
              berhasil += d.berhasil || 0;
              gagal    += d.gagal    || 0;
            } catch { berhasil++; }
            setUploadDone((prev) => ({ ...prev, [file.name]: 'done' }));
            setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
          } else {
            gagal++;
            setUploadDone((prev) => ({ ...prev, [file.name]: 'error' }));
            console.error('[HasilEdit] Upload gagal:', file.name, xhr.status);
          }
          resolve();
        };
        xhr.onerror   = () => {
          gagal++;
          setUploadDone((prev) => ({ ...prev, [file.name]: 'error' }));
          resolve();
        };
        xhr.ontimeout = () => {
          gagal++;
          setUploadDone((prev) => ({ ...prev, [file.name]: 'error' }));
          resolve();
        };
        xhr.timeout   = 60 * 60 * 1000; // 60 menit
        xhr.open('POST', `/api/sesi/${sesiId}/hasil-edit/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(form);
      })));
    }

    setUploadingHasil(false);
    if (berhasil > 0) {
      toast.success(`${berhasil} berkas hasil edit diunggah.${gagal > 0 ? ` ${gagal} gagal.` : ''}`);
      setHasilQueue([]);
      setUploadProgress({});
      setUploadDone({});
      onFaseChanged?.();
    } else {
      toast.error('Semua upload gagal. Cek koneksi atau ukuran file.');
    }
  }

  // Hitung overall progress
  const totalFiles   = hasilQueue.length;
  const doneCount    = Object.values(uploadDone).filter((v) => v === 'done').length;
  const errorCount   = Object.values(uploadDone).filter((v) => v === 'error').length;
  const overallPct   = totalFiles > 0
    ? Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / totalFiles)
    : 0;

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
                JPG · PNG · WebP · TIFF — maks. 2 GB/file
              </p>
            </div>

            {hasilQueue.length > 0 && (
              <div className="mt-2 card p-3 max-h-48 overflow-y-auto">
                {hasilQueue.map((f, i) => {
                  const pct    = uploadProgress[f.name] ?? 0;
                  const status = uploadDone[f.name];
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b
                                            border-border-dark last:border-0">
                      {/* Status dot */}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0
                        ${status === 'done'  ? 'bg-success' :
                          status === 'error' ? 'bg-error' :
                          uploadingHasil && pct > 0 ? 'bg-primary-container animate-pulse' :
                          'bg-border-dark'}`} />

                      {/* Filename */}
                      <span className="text-mono-label font-mono-label text-text-primary
                                       truncate flex-1 text-xs">
                        {f.name}
                      </span>

                      {/* Size */}
                      <span className="text-mono-label font-mono-label text-text-muted
                                       shrink-0 text-xs">
                        {(f.size/1024/1024).toFixed(1)} MB
                      </span>

                      {/* Progress bar atau icon */}
                      {uploadingHasil && status !== 'done' && status !== 'error' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-16 h-1.5 bg-border-dark rounded-full overflow-hidden">
                            <div className="h-full bg-primary-container transition-all duration-300"
                                 style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-text-muted w-7 text-right">{pct}%</span>
                        </div>
                      )}
                      {status === 'done' && (
                        <span className="material-symbols-outlined text-success shrink-0"
                              style={{fontSize:14}}>check_circle</span>
                      )}
                      {status === 'error' && (
                        <span className="material-symbols-outlined text-error shrink-0"
                              style={{fontSize:14}}>error</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Overall progress bar saat uploading */}
            {uploadingHasil && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-mono-label font-mono-label text-text-muted text-xs">
                    {doneCount + errorCount}/{totalFiles} file selesai
                  </span>
                  <span className="text-mono-label font-mono-label text-primary-container
                                   font-medium text-xs">
                    {overallPct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-border-dark rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container transition-all duration-300 rounded-full"
                       style={{ width: `${overallPct}%` }} />
                </div>
                {errorCount > 0 && (
                  <p className="text-xs text-error mt-1">{errorCount} file gagal</p>
                )}
              </div>
            )}

            {hasilQueue.length > 0 && !uploadingHasil && (
              <div className="flex gap-2 mt-2">
                <button onClick={uploadHasil}
                  className="btn-primary text-xs py-2">
                  <span className="material-symbols-outlined" style={{fontSize:14}}>upload</span>
                  Upload {hasilQueue.length} file
                </button>
                <button onClick={() => { setHasilQueue([]); setUploadProgress({}); setUploadDone({}); }}
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
