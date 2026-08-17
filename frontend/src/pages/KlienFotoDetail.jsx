import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Spinner       from '../components/common/Spinner';
import StatusBadge   from '../components/common/StatusBadge';
import QualityBadges from '../components/common/QualityBadges';
import { proxyUrl }  from '../services/proxyUrl';
import api           from '../services/api';

const OPTIONS_FULL = [
  {
    value: 'siap_edit', label: 'Ready to Edit',
    desc:  'This photo is great — approve for editing.',
    icon:  'check_circle', border: 'hover:border-success', active: 'border-success bg-success/10 text-success',
  },
  {
    value: 'revisi', label: 'Needs Revision',
    desc:  'Request a change or re-shoot.',
    icon:  'edit_note', border: 'hover:border-yellow-500', active: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
  },
  {
    value: 'ditolak', label: 'Reject',
    desc:  'This photo is not needed.',
    icon:  'close', border: 'hover:border-error', active: 'border-error bg-error/10 text-error',
  },
];

const OPTIONS_KURATOR = [
  {
    value: 'siap_edit', label: 'Agree',
    desc:  "Keep the photographer's selection.",
    icon:  'thumb_up', border: 'hover:border-success', active: 'border-success bg-success/10 text-success',
  },
  {
    value: 'revisi', label: 'Request Revision',
    desc:  'Ask photographer to reconsider.',
    icon:  'refresh', border: 'hover:border-yellow-500', active: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
  },
];

export default function KlienFotoDetail() {
  const { token, fotoId } = useParams();
  const navigate          = useNavigate();
  const queryClient       = useQueryClient();

  const [status,      setStatus]      = useState('');
  const [catatan,     setCatatan]     = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showPanel,   setShowPanel]   = useState(false);

  const { data } = useQuery({
    queryKey: ['klien', token],
    queryFn:  () => api.get(`/klien/${token}/foto`).then((r) => r.data),
    staleTime: 0,
  });

  const mode             = data?.sesi?.mode_seleksi || 'pilih_sendiri';
  const isLihatSaja      = mode === 'lihat_saja';
  const isOlehFotografer = mode === 'oleh_fotografer';

  const foto     = data?.foto?.find((f) => f.id === fotoId);
  const sesi     = data?.sesi;
  const fotoList = data?.foto ?? [];
  const idx      = fotoList.findIndex((f) => f.id === fotoId);
  const prevFoto = idx > 0                   ? fotoList[idx - 1] : null;
  const nextFoto = idx < fotoList.length - 1 ? fotoList[idx + 1] : null;

  useEffect(() => {
    if (foto) {
      setStatus(foto.status_seleksi !== 'belum_ditinjau' ? foto.status_seleksi : '');
      setCatatan(foto.catatan_klien || '');
    }
  }, [foto]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/klien/${token}/foto/${fotoId}`, {
      status_seleksi: status || 'belum_ditinjau',
      catatan_klien:  catatan || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['klien', token] });
      toast.success('Saved!');
      if (nextFoto) navigate(`/k/${token}/foto/${nextFoto.id}`);
      else { navigate(`/k/${token}/galeri`); toast('All photos reviewed! 🎉', { icon: '✅' }); }
    },
    onError: () => toast.error('Failed to save.'),
  });

  async function handleDownload() {
    setDownloading(true);
    try {
      const { data: dl } = await api.get(`/klien/${token}/foto/${fotoId}/download`);
      const a = document.createElement('a');
      a.href = dl.url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast.error('Download failed.'); }
    finally { setDownloading(false); }
  }

  if (!data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size={32} />
    </div>
  );

  if (!foto) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card p-8 text-center">
        <p className="text-on-surface-variant text-body-md font-body-md">Photo not found.</p>
        <button className="btn-secondary mt-4" onClick={() => navigate(`/k/${token}/galeri`)}>
          Back to Gallery
        </button>
      </div>
    </div>
  );

  const options = isOlehFotografer ? OPTIONS_KURATOR : OPTIONS_FULL;

  // Panel content — dipakai di desktop sidebar DAN mobile bottom sheet
  const renderPanelContent = () => (
    <>
      {/* File info */}
      <div className="flex justify-between items-start border-b border-border-dark pb-4">
        <div>
          <h2 className="text-label-sm font-label-sm text-text-primary uppercase tracking-wider">
            {foto.nama_file}
          </h2>
          <p className="text-mono-label font-mono-label text-text-muted mt-0.5">
            {foto.tipe_file?.split('/')[1]?.toUpperCase() || 'IMG'}
          </p>
        </div>
      </div>

      {/* AI Quality panel */}
      {(foto.quality_analyzed === false || foto.quality_analyzed === null ||
        foto.is_blurry || (foto.face_detected && foto.eyes_closed) || foto.is_duplicate) && (
        <div className="card p-4">
          <p className="text-mono-label font-mono-label text-text-muted uppercase tracking-widest mb-2">
            AI Analysis
          </p>
          <QualityBadges foto={foto} size="md" showAnalyzing />
          <div className="mt-3 space-y-1.5">
            {foto.is_blurry && (
              <p className="text-mono-label font-mono-label text-text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container shrink-0" />
                Blur detected — consider requesting revision.
              </p>
            )}
            {foto.face_detected && foto.eyes_closed && (
              <p className="text-mono-label font-mono-label text-text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                Eyes closed detected.
              </p>
            )}
            {foto.is_duplicate && (
              <p className="text-mono-label font-mono-label text-text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                Similar photo exists in session.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selection controls */}
      {!isLihatSaja ? (
        <>
          <div>
            <p className="text-mono-label font-mono-label text-text-muted uppercase tracking-widest mb-3">
              Decision
            </p>
            <div className="flex flex-col gap-2">
              {options.map(({ value, label, desc, icon, border, active }) => {
                const sel = status === value;
                return (
                  <button key={value} onClick={() => setStatus(value)}
                    className={`w-full flex items-center gap-3 p-3 rounded border transition-all text-left
                               min-h-[60px] active:scale-[0.98]
                      ${sel
                        ? active
                        : `border-border-dark bg-surface-dark text-text-primary ${border}`
                      }`}
                    aria-pressed={sel}>
                    <span className="material-symbols-outlined shrink-0"
                          style={{fontSize:20, fontVariationSettings: sel ? "'FILL' 1" : "'FILL' 0"}}>
                      {icon}
                    </span>
                    <div>
                      <p className="text-label-sm font-label-sm uppercase tracking-wider">{label}</p>
                      <p className="text-mono-label font-mono-label opacity-60 mt-0.5 text-xs">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-mono-label font-mono-label text-text-muted uppercase tracking-widest"
                   htmlFor="notes">
              Notes for Photographer
            </label>
            <textarea id="notes" rows={4}
              className="flex-1 bg-surface-dim border border-border-dark rounded p-3
                         text-body-md font-body-md text-text-primary resize-none
                         focus:outline-none focus:border-primary-container
                         placeholder:text-text-muted/50 transition-colors min-h-[100px]"
              placeholder="Add retouching notes or requests…"
              value={catatan} onChange={(e) => setCatatan(e.target.value)}
              maxLength={1000}
            />
            <p className="text-right text-mono-label font-mono-label text-text-muted">
              {catatan.length}/1000
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border-dark">
            <button
              className="btn-primary w-full justify-center py-4 md:py-3 text-base md:text-sm
                         active:scale-[0.98] transition-transform"
              onClick={() => { mutation.mutate(); setShowPanel(false); }}
              disabled={!status || mutation.isPending}>
              {mutation.isPending
                ? 'Saving…'
                : nextFoto ? 'Save & Next →' : 'Save Selection'}
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="btn-secondary w-full justify-center py-3 md:py-2.5 text-sm md:text-xs
                         active:scale-[0.98] transition-transform">
              {downloading
                ? <><Spinner size={12} /> Preparing…</>
                : <><span className="material-symbols-outlined" style={{fontSize:16}}>cloud_download</span>
                    Download Original</>
              }
            </button>
          </div>
        </>
      ) : (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-on-surface-variant" style={{fontSize:16}}>
              visibility
            </span>
            <p className="text-label-sm font-label-sm text-text-muted uppercase tracking-wider">
              View Only Mode
            </p>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant text-sm leading-relaxed">
            You're in view-only mode. To make selections, go back and choose a different mode.
          </p>
          <button onClick={() => navigate(`/k/${token}`)}
            className="btn-secondary w-full justify-center mt-3 text-xs py-3 active:scale-[0.98]">
            ← Change Mode
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <nav className="bg-surface border-b border-border-dark px-4 md:px-6 h-14 md:h-16
                      flex items-center gap-2 md:gap-3 sticky top-0 z-40">
        <button onClick={() => navigate(`/k/${token}/galeri`)}
          className="text-on-surface-variant hover:text-primary transition-colors
                     p-2 -m-2 active:scale-95"
          aria-label="Back">
          <span className="material-symbols-outlined" style={{fontSize:22}}>arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm md:text-body-md font-body-md text-text-primary truncate font-medium">
            {foto.nama_file}
          </p>
          <p className="text-[11px] md:text-mono-label font-mono-label text-text-muted">
            {sesi?.nama_sesi} · {idx + 1}/{fotoList.length}
          </p>
        </div>
        <StatusBadge status={foto.status_seleksi} />
        {/* Mobile: tombol buka panel */}
        <button onClick={() => setShowPanel(true)}
          className="md:hidden p-2 -m-2 text-primary-container active:scale-95"
          aria-label="Open selection panel">
          <span className="material-symbols-outlined" style={{fontSize:22}}>tune</span>
        </button>
      </nav>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Photo preview */}
        <section className="flex-1 bg-surface-dim relative flex items-center justify-center p-2 md:p-4 overflow-hidden">
          {/* Nav arrows */}
          {[
            { foto: prevFoto, icon: 'chevron_left',  side: 'left-2 md:left-4',   dir: '-translate-x-1' },
            { foto: nextFoto, icon: 'chevron_right', side: 'right-2 md:right-4', dir: 'translate-x-1'  },
          ].map(({ foto: f, icon, side, dir }) => (
            <button key={icon}
              disabled={!f}
              onClick={() => f && navigate(`/k/${token}/foto/${f.id}`)}
              className={`absolute ${side} z-10 w-12 h-12 md:w-10 md:h-10 flex items-center justify-center
                          rounded-full border border-border-dark bg-surface-dark
                          text-text-primary hover:text-primary hover:border-primary
                          disabled:opacity-20 disabled:cursor-not-allowed transition-colors group
                          active:scale-95`}>
              <span className={`material-symbols-outlined group-hover:${dir} transition-transform`}
                    style={{fontSize:24}}>{icon}</span>
            </button>
          ))}

          {/* Image */}
          <div className="relative shadow-2xl max-w-full max-h-[calc(100vh-10rem)] md:max-h-[calc(100vh-8rem)]">
            <img
              src={proxyUrl(sesi?.nama_bucket, foto.object_key, { preset: 'medium', wm: true })}
              alt={foto.nama_file}
              className="max-w-full max-h-[calc(100vh-10rem)] md:max-h-[calc(100vh-8rem)] object-contain
                         border border-border-dark"
            />
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center
                            pointer-events-none select-none overflow-hidden">
              <span className="text-headline-md md:text-headline-lg font-headline-lg font-bold
                               text-white/20 tracking-[0.2em] -rotate-12 uppercase whitespace-nowrap">
                CFC
              </span>
            </div>
          </div>
        </section>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-96 shrink-0 border-l border-border-dark bg-surface
                          flex-col overflow-y-auto">
          <div className="p-5 flex flex-col gap-5 h-full">
            {renderPanelContent()}
          </div>
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      {showPanel && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end"
             onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/60 animate-[fadeIn_0.2s_ease]" />
          <div className="relative w-full bg-surface rounded-t-2xl border-t border-l border-r
                          border-border-dark max-h-[85vh] flex flex-col animate-[slideUp_0.3s_ease]"
               onClick={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <div className="flex justify-center py-3 border-b border-border-dark">
              <div className="w-10 h-1 bg-border-dark rounded-full" />
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-safe">
              {renderPanelContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
