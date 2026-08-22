/**
 * UploadZone.jsx — Presigned URL Upload
 * =======================================
 * Alur baru: Browser upload langsung ke MinIO (bypass backend RAM)
 * 1. Request presigned PUT URL dari backend untuk setiap file
 * 2. Browser PUT file langsung ke MinIO menggunakan presigned URL
 * 3. Setelah semua selesai, kirim konfirmasi ke backend untuk simpan metadata ke DB
 *
 * Jauh lebih cepat karena tidak ada bottleneck di RAM backend.
 */
import { useCallback, useState } from 'react';
import { useDropzone }           from 'react-dropzone';
import toast                     from 'react-hot-toast';
import Spinner                   from '../common/Spinner';
import api                       from '../../services/api';

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png':  ['.png'],
  'image/webp': ['.webp'],
  'image/tiff': ['.tif', '.tiff'],
};

// Upload concurrency — berapa file yang diupload paralel sekaligus
const CONCURRENCY = 3;

function FileRow({ file, status, error, progress }) {
  const dot = status === 'done'     ? 'bg-success'
            : status === 'error'    ? 'bg-error'
            : status === 'uploading' ? 'bg-primary-container animate-pulse'
            : 'bg-border-dark';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-dark last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="flex-1 text-text-primary truncate text-xs">{file.name}</span>
      <span className="text-mono-label font-mono-label text-text-muted shrink-0 text-xs">
        {(file.size / 1024 / 1024).toFixed(1)} MB
      </span>
      {status === 'uploading' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-16 h-1 bg-border-dark rounded-full overflow-hidden">
            <div className="h-full bg-primary-container transition-all duration-300"
                 style={{ width: `${progress || 0}%` }} />
          </div>
          <span className="text-[10px] text-text-muted w-7 text-right">{progress || 0}%</span>
        </div>
      )}
      {status === 'done' && (
        <span className="material-symbols-outlined text-success shrink-0" style={{fontSize:14}}>
          check_circle
        </span>
      )}
      {status === 'error' && (
        <span className="material-symbols-outlined text-error shrink-0" style={{fontSize:14}}
              title={error}>error</span>
      )}
    </div>
  );
}

export default function UploadZone({ sesiId, onUploaded }) {
  const [queue,     setQueue]     = useState([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted) => {
    setQueue((prev) => [
      ...prev,
      ...accepted.map((f) => ({ file: f, status: 'pending', error: null, progress: 0 })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:   ACCEPT,
    multiple: true,
    maxSize:  2 * 1024 * 1024 * 1024, // 2 GB per file
    onDropRejected: (rej) => rej.forEach((r) => {
      const reason = r.errors[0]?.code === 'file-too-large'
        ? `${r.file.name}: File terlalu besar (maks 2 GB)`
        : r.errors[0]?.code === 'file-invalid-type'
        ? `${r.file.name}: Tipe file tidak didukung`
        : `${r.file.name}: ${r.errors[0]?.message}`;
      toast.error(reason);
    }),
  });

  // Upload satu file langsung ke MinIO via presigned PUT URL
  async function uploadOnefile(item, presignData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`MinIO error ${xhr.status}: ${xhr.responseText.slice(0, 100)}`));
        }
      };

      xhr.onerror   = () => reject(new Error('Network error saat upload ke MinIO'));
      xhr.ontimeout = () => reject(new Error('Timeout upload ke MinIO'));

      xhr.open('PUT', presignData.upload_url);
      xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
      xhr.timeout = 30 * 60 * 1000; // 30 menit timeout per file
      xhr.send(item.file);
    });
  }

  async function startUpload() {
    if (!queue.length || uploading) return;
    setUploading(true);

    const pending = queue.filter((q) => q.status === 'pending');
    if (pending.length === 0) { setUploading(false); return; }

    // ── Step 1: Request presigned URLs dari backend (semua sekaligus) ──
    let presigned = [];
    try {
      const { data } = await api.post(`/sesi/${sesiId}/foto/presign`, {
        files: pending.map((q) => ({
          nama_file:   q.file.name,
          mime_type:   q.file.type || 'image/jpeg',
          ukuran_file: q.file.size,
        })),
      });
      presigned = data.presigned;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mendapatkan upload URL.');
      setUploading(false);
      return;
    }

    // ── Step 2: Upload paralel ke MinIO (CONCURRENCY file sekaligus) ──
    const results = []; // { presignData, success, error }

    for (let i = 0; i < presigned.length; i += CONCURRENCY) {
      const batch = presigned.slice(i, i + CONCURRENCY);
      const batchItems = pending.slice(i, i + CONCURRENCY);

      await Promise.all(batch.map(async (presignData, bIdx) => {
        const item = batchItems[bIdx];
        if (!item) return;

        // Set status uploading
        setQueue((prev) => prev.map((q) =>
          q.file === item.file ? { ...q, status: 'uploading', progress: 0 } : q
        ));

        try {
          await uploadOnefile(item, presignData, (pct) => {
            setQueue((prev) => prev.map((q) =>
              q.file === item.file ? { ...q, progress: pct } : q
            ));
          });

          setQueue((prev) => prev.map((q) =>
            q.file === item.file ? { ...q, status: 'done', progress: 100 } : q
          ));
          results.push({ presignData, success: true });

        } catch (err) {
          setQueue((prev) => prev.map((q) =>
            q.file === item.file ? { ...q, status: 'error', error: err.message } : q
          ));
          results.push({ presignData, success: false, error: err.message });
          console.error('[Upload] Gagal:', presignData.nama_file, err.message);
        }
      }));
    }

    // ── Step 3: Konfirmasi ke backend — simpan metadata yang berhasil ke DB ──
    const berhasil = results.filter((r) => r.success);
    if (berhasil.length > 0) {
      try {
        await api.post(`/sesi/${sesiId}/foto/confirm`, {
          uploads: berhasil.map((r) => ({
            object_key:  r.presignData.object_key,
            nama_file:   r.presignData.nama_file,
            mime_type:   r.presignData.mime_type,
            ukuran_file: r.presignData.ukuran_file,
            nama_bucket: r.presignData.nama_bucket,
          })),
        });
        onUploaded?.();
      } catch (err) {
        toast.error('Upload berhasil tapi gagal menyimpan metadata. Coba refresh.');
      }
    }

    const gagal = results.filter((r) => !r.success).length;
    if (berhasil.length > 0) {
      toast.success(`${berhasil.length} foto berhasil diupload${gagal > 0 ? `, ${gagal} gagal` : ''}.`);
    } else {
      toast.error('Semua upload gagal. Coba lagi.');
    }

    setUploading(false);
  }

  const pendingCount  = queue.filter((q) => q.status === 'pending').length;
  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const doneCount     = queue.filter((q) => q.status === 'done').length;
  const errorCount    = queue.filter((q) => q.status === 'error').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div {...getRootProps()}
        className={`border border-dashed rounded p-10 md:p-12 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-primary-container bg-primary-container/10'
            : 'border-border-dark bg-surface-dark hover:border-outline hover:bg-surface-container'
          }`}>
        <input {...getInputProps()} />
        <span className={`material-symbols-outlined block mb-3 mx-auto transition-colors
          ${isDragActive ? 'text-primary-container' : 'text-text-muted'}`}
          style={{fontSize:40}}>cloud_upload</span>
        {isDragActive ? (
          <p className="text-label-sm font-label-sm text-primary-container uppercase tracking-wider">
            Drop files here…
          </p>
        ) : (
          <>
            <p className="text-body-md font-body-md text-text-primary font-medium mb-1">
              Drag photos here, or click to browse
            </p>
            <p className="text-mono-label font-mono-label text-text-muted">
              JPG · PNG · WebP · TIFF — max 2 GB per file
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {queue.length > 0 && (
        <div className="card p-3 max-h-72 overflow-y-auto">
          {queue.map((item, i) => <FileRow key={i} {...item} />)}
        </div>
      )}

      {/* Stats bar */}
      {queue.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-primary min-h-[44px]" onClick={startUpload}
            disabled={uploading || pendingCount === 0}>
            {uploading
              ? <><Spinner size={14} /> Uploading {uploadingCount > 0 ? `(${uploadingCount} aktif)` : ''}…</>
              : <><span className="material-symbols-outlined" style={{fontSize:16}}>upload</span>
                  Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>
            }
          </button>
          <button className="btn-secondary min-h-[44px]"
            onClick={() => setQueue([])} disabled={uploading}>
            Clear
          </button>
          <span className="text-mono-label font-mono-label text-text-muted ml-auto flex gap-3">
            {doneCount    > 0 && <span className="text-success">✓ {doneCount}</span>}
            {uploadingCount > 0 && <span className="text-primary-container">↑ {uploadingCount}</span>}
            {errorCount   > 0 && <span className="text-error">✗ {errorCount}</span>}
            <span className="text-text-muted">× {queue.length}</span>
          </span>
        </div>
      )}
    </div>
  );
}
