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

function FileRow({ file, status, error }) {
  const dot = status === 'done'    ? 'bg-success'
            : status === 'error'   ? 'bg-error'
            : 'bg-primary-container';
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border-dark
                    last:border-0 text-body-md font-body-md">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}
        ${status === 'pending' ? 'animate-pulse' : ''}`} />
      <span className="flex-1 text-text-primary truncate text-xs">{file.name}</span>
      <span className="text-mono-label font-mono-label text-text-muted shrink-0">
        {(file.size / 1024 / 1024).toFixed(1)} MB
      </span>
      {status === 'pending' && <Spinner size={12} />}
      {status === 'error' && (
        <span className="material-symbols-outlined text-error" style={{fontSize:14}}
              title={error}>error</span>
      )}
    </div>
  );
}

export default function UploadZone({ sesiId, onUploaded }) {
  const [queue,     setQueue]     = useState([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted) => {
    setQueue((prev) => [...prev, ...accepted.map((f) => ({ file: f, status: 'pending', error: null }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPT, multiple: true,
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (rej) => rej.forEach((r) => toast.error(`${r.file.name}: ${r.errors[0]?.message}`)),
  });

  async function startUpload() {
    if (!queue.length || uploading) return;
    setUploading(true);
    const pending = queue.filter((q) => q.status === 'pending');
    for (let i = 0; i < pending.length; i += 10) {
      const batch = pending.slice(i, i + 10);
      const form  = new FormData();
      batch.forEach(({ file }) => form.append('foto', file));
      try {
        const { data } = await api.post(`/sesi/${sesiId}/foto/upload`, form,
          { headers: { 'Content-Type': 'multipart/form-data' } });
        setQueue((prev) => prev.map((q) => {
          if (!batch.find((b) => b.file === q.file)) return q;
          const failed = data.failed?.find((f) => f.nama_file === q.file.name);
          return failed ? { ...q, status: 'error', error: failed.error } : { ...q, status: 'done' };
        }));
        if (data.berhasil > 0) onUploaded?.();
      } catch (err) {
        const msg = err.response?.data?.error || 'Upload failed.';
        setQueue((prev) => prev.map((q) =>
          batch.find((b) => b.file === q.file) ? { ...q, status: 'error', error: msg } : q
        ));
        toast.error(msg);
      }
    }
    setUploading(false);
    toast.success(`Upload complete.`);
  }

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const doneCount    = queue.filter((q) => q.status === 'done').length;
  const errorCount   = queue.filter((q) => q.status === 'error').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div {...getRootProps()}
        className={`border border-dashed rounded p-12 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-primary-container bg-primary-container/10'
            : 'border-border-dark bg-surface-dark hover:border-outline hover:bg-surface-container'
          }`}
        aria-label="Drag and drop area">
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
              JPG · PNG · WebP · TIFF — max 50 MB per file
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {queue.length > 0 && (
        <div className="card p-3 max-h-60 overflow-y-auto">
          {queue.map((item, i) => <FileRow key={i} {...item} />)}
        </div>
      )}

      {/* Actions */}
      {queue.length > 0 && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={startUpload}
            disabled={uploading || pendingCount === 0}>
            {uploading
              ? <><Spinner size={14} /> Uploading…</>
              : <><span className="material-symbols-outlined" style={{fontSize:14}}>upload</span>
                  Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>
            }
          </button>
          <button className="btn-secondary" onClick={() => setQueue([])} disabled={uploading}>
            Clear
          </button>
          <span className="text-mono-label font-mono-label text-text-muted ml-auto">
            {doneCount > 0 && <span className="text-success mr-2">✓ {doneCount}</span>}
            {errorCount > 0 && <span className="text-error">✗ {errorCount}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
