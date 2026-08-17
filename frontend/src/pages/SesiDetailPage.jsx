import { useState, useCallback } from 'react';
import { useParams, Link }       from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar          from '../components/common/Navbar';
import StatusBadge     from '../components/common/StatusBadge';
import QualityBadges   from '../components/common/QualityBadges';
import Spinner         from '../components/common/Spinner';
import AiCullingPanel  from '../components/photographer/AiCullingPanel';
import FasePanel       from '../components/photographer/FasePanel';
import { proxyUrl }    from '../services/proxyUrl';
import api             from '../services/api';

const STATUS_CYCLE = ['siap_edit', 'revisi', 'ditolak', 'belum_ditinjau'];

const OVERLAY = {
  siap_edit: 'ring-inset ring-1 ring-success/60 bg-success/5',
  revisi:    'ring-inset ring-1 ring-yellow-500/60 bg-yellow-500/5',
  ditolak:   'ring-inset ring-1 ring-error/60 bg-error/5',
};

const STATUS_DOT = {
  siap_edit: 'bg-success',
  revisi:    'bg-yellow-500',
  ditolak:   'bg-error',
};

const QUALITY_FILTERS = [
  { key: 'semua',        label: 'All' },
  { key: 'bermasalah',   label: 'Issues' },
  { key: 'is_blurry',    label: 'Blur' },
  { key: 'eyes_closed',  label: 'Eyes' },
  { key: 'is_duplicate', label: 'Similar' },
];

export default function SesiDetailPage() {
  const { sesiId }  = useParams();
  const queryClient = useQueryClient();

  const [qualityFilter, setQualityFilter] = useState('semua');
  const [seleksiMode,   setSeleksiMode]   = useState(false);

  const { data: sesi, isLoading: loadingSesi } = useQuery({
    queryKey: ['sesi', sesiId],
    queryFn:  () => api.get(`/sesi/${sesiId}`).then((r) => r.data),
  });

  const { data: fotoList, isLoading: loadingFoto } = useQuery({
    queryKey: ['foto', sesiId],
    queryFn:  () => api.get(`/sesi/${sesiId}/foto`).then((r) => r.data),
    refetchInterval: ({ state }) => {
      const list = state.data;
      if (!list) return false;
      return list.some((f) => !f.quality_analyzed) ? 6000 : false;
    },
  });

  const tutupMut = useMutation({
    mutationFn: () => api.patch(`/sesi/${sesiId}/tutup`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesi', sesiId] });
      queryClient.invalidateQueries({ queryKey: ['sesi'] });
      toast.success('Session closed.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/sesi/${sesiId}/foto/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', sesiId] });
      queryClient.invalidateQueries({ queryKey: ['sesi', sesiId] });
      toast.success('Photo deleted.');
    },
  });

  const seleksiFotoMut = useMutation({
    mutationFn: ({ fotoId, status }) =>
      api.patch(`/sesi/${sesiId}/foto/${fotoId}/seleksi`, { status_seleksi: status }),
    onSuccess: (resp) => {
      queryClient.setQueryData(['foto', sesiId], (old) =>
        old?.map((f) => f.id === resp.data.id ? { ...f, ...resp.data } : f)
      );
    },
    onError: () => toast.error('Failed to update.'),
  });

  const seleksiMassalMut = useMutation({
    mutationFn: ({ foto_ids, status_seleksi }) =>
      api.patch(`/sesi/${sesiId}/seleksi-massal`, { foto_ids, status_seleksi }),
    onSuccess: (_, { foto_ids, status_seleksi }) => {
      queryClient.setQueryData(['foto', sesiId], (old) =>
        old?.map((f) => foto_ids.includes(f.id) ? { ...f, status_seleksi } : f)
      );
      toast.success(`${foto_ids.length} photos updated.`);
    },
  });

  const handleFotoClick = useCallback((foto) => {
    if (!seleksiMode) return;
    const cur  = foto.status_seleksi || 'belum_ditinjau';
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
    seleksiFotoMut.mutate({ fotoId: foto.id, status: next });
  }, [seleksiMode, seleksiFotoMut]);

  function autoSeleksiAI() {
    const bermasalah = fotoList?.filter(
      (f) => f.quality_analyzed && (f.is_blurry || (f.face_detected && f.eyes_closed))
    ) || [];
    if (!bermasalah.length) { toast('No issues detected to auto-mark.'); return; }
    seleksiMassalMut.mutate({ foto_ids: bermasalah.map((f) => f.id), status_seleksi: 'revisi' });
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/k/${sesi.token_akses}`);
    toast.success('Client link copied!');
  }

  async function downloadSeleksi() {
    const { data } = await api.get(`/sesi/${sesiId}/unduh-seleksi`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `seleksi-${sesiId}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function filteredFoto(list) {
    if (!list) return [];
    switch (qualityFilter) {
      case 'is_blurry':    return list.filter((f) => f.is_blurry);
      case 'eyes_closed':  return list.filter((f) => f.face_detected && f.eyes_closed);
      case 'is_duplicate': return list.filter((f) => f.is_duplicate);
      case 'bermasalah':   return list.filter((f) =>
        f.is_blurry || (f.face_detected && f.eyes_closed) || f.is_duplicate);
      default: return list;
    }
  }

  const displayedFoto = filteredFoto(fotoList);

  const qSummary = {
    blurry:    fotoList?.filter((f) => f.is_blurry).length || 0,
    eyes:      fotoList?.filter((f) => f.face_detected && f.eyes_closed).length || 0,
    duplicate: fotoList?.filter((f) => f.is_duplicate).length || 0,
    pending:   fotoList?.filter((f) => !f.quality_analyzed).length || 0,
  };

  const countFor = (key) => {
    switch (key) {
      case 'is_blurry':    return qSummary.blurry;
      case 'eyes_closed':  return qSummary.eyes;
      case 'is_duplicate': return qSummary.duplicate;
      case 'bermasalah':   return fotoList?.filter((f) =>
        f.is_blurry || (f.face_detected && f.eyes_closed) || f.is_duplicate).length || 0;
      default: return fotoList?.length || 0;
    }
  };

  if (loadingSesi) return (
    <div className="min-h-screen bg-background flex">
      <Navbar />
      <div className="flex-1 md:ml-64 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Navbar />

      <main className="flex-1 md:ml-64 flex flex-col">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14
                           border-b border-border-dark bg-surface sticky top-0 z-10">
          <span className="text-headline-lg-mobile font-headline-lg-mobile text-primary">CFC</span>
        </header>

        {/* Top bar */}
        <div className="border-b border-border-dark bg-surface px-4 md:px-6 h-16
                        flex items-center justify-between sticky top-0 md:top-0 z-30">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_back</span>
            </Link>
            <div>
              <h1 className="text-headline-md font-headline-md text-text-primary leading-tight">
                {sesi?.nama_sesi}
              </h1>
              <div className="flex items-center gap-2">
                {sesi?.status_sesi === 'aktif' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                )}
                <span className="text-mono-label font-mono-label text-on-surface-variant">
                  {sesi?.status_sesi === 'aktif' ? 'Active' : 'Closed'} · {sesi?.nama_klien}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <nav className="flex items-center gap-2">
            {sesi?.status_sesi === 'aktif' && (
              <Link to={`/sesi/${sesiId}/upload`} className="btn-primary text-xs py-2">
                <span className="material-symbols-outlined" style={{fontSize:14}}>cloud_upload</span>
                Upload
              </Link>
            )}
            <button className="btn-secondary text-xs py-2" onClick={copyLink}>
              <span className="material-symbols-outlined" style={{fontSize:14}}>link</span>
              <span className="hidden sm:inline">Client Link</span>
            </button>
            <button className="btn-secondary text-xs py-2" onClick={downloadSeleksi}>
              <span className="material-symbols-outlined" style={{fontSize:14}}>download</span>
              <span className="hidden sm:inline">Export</span>
            </button>
            {sesi?.status_sesi === 'aktif' && (
              <button
                className="btn-secondary text-xs py-2 text-error border-error/30 hover:bg-error/10"
                onClick={() => window.confirm('Close this session?') && tutupMut.mutate()}>
                <span className="material-symbols-outlined" style={{fontSize:14}}>lock</span>
              </button>
            )}
          </nav>
        </div>

        <div className="p-4 md:p-6 flex flex-col gap-3 max-w-[1800px] w-full mx-auto">

          {/* Stats strip */}
          <div className="flex flex-wrap gap-4 text-mono-label font-mono-label text-text-muted">
            <span className="text-text-primary font-medium">{sesi?.total_foto} photos</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {sesi?.siap_edit} Ready
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              {sesi?.revisi} Revision
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              {sesi?.ditolak} Rejected
            </span>
          </div>

          {/* Fase + Ekspor Lightroom panel */}
          <FasePanel sesiId={sesiId} sesi={sesi} onFaseChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['sesi', sesiId] });
          }} />

          {/* AI Culling panel */}
          {fotoList && fotoList.length > 0 && (
            <AiCullingPanel
              sesiId={sesiId} fotoList={fotoList} qSummary={qSummary}
              onAutoSeleksi={autoSeleksiAI}
              onTriggerAll={() =>
                api.post(`/sesi/${sesiId}/quality-trigger-all`)
                  .then(() => toast.success('Re-analysis scheduled.'))
                  .catch(() => toast.error('Failed to schedule.'))
              }
            />
          )}

          {/* Toolbar */}
          {fotoList && fotoList.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Mode toggle */}
              <button onClick={() => setSeleksiMode((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded border
                            text-label-sm font-label-sm uppercase tracking-wider transition-all text-xs
                  ${seleksiMode
                    ? 'bg-primary-container/20 border-primary-container text-primary-container'
                    : 'border-border-dark text-on-surface-variant hover:border-outline'
                  }`}>
                <span className="material-symbols-outlined" style={{fontSize:14,
                  fontVariationSettings: seleksiMode ? "'FILL' 1" : "'FILL' 0"}}>
                  check_box
                </span>
                {seleksiMode ? 'Pick Mode: ON — click photo to cycle status' : 'Enable Pick Mode'}
              </button>

              {/* Quality filters */}
              <div className="flex gap-1.5 flex-wrap ml-auto">
                {QUALITY_FILTERS.map(({ key, label }) => (
                  <button key={key} onClick={() => setQualityFilter(key)}
                    className={`px-2.5 py-1 rounded-[2px] text-mono-label font-mono-label
                                uppercase tracking-wider border transition-colors text-xs
                      ${qualityFilter === key
                        ? 'bg-primary-container/20 border-primary-container text-primary-container'
                        : 'border-border-dark text-text-muted hover:bg-surface-container-high'
                      }`}>
                    {label}
                    {key !== 'semua' && (
                      <span className="ml-1 opacity-60">({countFor(key)})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Photo grid */}
          <section>
            {loadingFoto && (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            )}
            {!loadingFoto && !fotoList?.length && (
              <div className="card p-16 text-center">
                <span className="material-symbols-outlined text-text-muted block mb-3"
                      style={{fontSize:40}}>add_photo_alternate</span>
                <p className="text-body-md font-body-md text-on-surface-variant">
                  No photos yet. Click <strong>Upload</strong> to add some.
                </p>
              </div>
            )}
            {!loadingFoto && fotoList?.length > 0 && displayedFoto.length === 0 && (
              <div className="card p-10 text-center text-on-surface-variant text-body-md font-body-md">
                No photos match this filter.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {displayedFoto.map((foto, idx) => (
                <div key={foto.id}
                  className={`relative overflow-hidden rounded border transition-all duration-200
                    bg-surface-dark group
                    ${seleksiMode ? 'cursor-pointer select-none' : ''}
                    ${foto.status_seleksi !== 'belum_ditinjau'
                      ? 'border-outline-variant'
                      : 'border-border-dark hover:border-outline-variant'
                    }`}
                  onClick={() => handleFotoClick(foto)}>

                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-surface-container-lowest relative">
                    <img
                      src={proxyUrl(sesi?.nama_bucket, foto.object_key, { preset: 'thumb', wm: false })}
                      alt={foto.nama_file}
                      loading={idx < 12 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Status overlay */}
                    {foto.status_seleksi !== 'belum_ditinjau' && (
                      <div className={`absolute inset-0 ${OVERLAY[foto.status_seleksi] || ''}`} />
                    )}

                    {/* Status dot top-left */}
                    {foto.status_seleksi !== 'belum_ditinjau' && (
                      <div className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full
                                       ${STATUS_DOT[foto.status_seleksi] || 'bg-text-muted'}
                                       shadow-[0_0_6px_currentColor]`} />
                    )}

                    {/* Delete button */}
                    {!seleksiMode && sesi?.status_sesi === 'aktif' && (
                      <button
                        className="absolute top-1.5 right-1.5 bg-surface-dim/80 text-error
                                   rounded p-0.5 opacity-0 group-hover:opacity-100
                                   hover:bg-error hover:text-white transition-all z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.confirm(`Delete "${foto.nama_file}"?`) && deleteMut.mutate(foto.id);
                        }}
                        aria-label={`Delete ${foto.nama_file}`}>
                        <span className="material-symbols-outlined" style={{fontSize:12}}>close</span>
                      </button>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-1.5 bg-surface-dark border-t border-border-dark">
                    <p className="text-mono-label font-mono-label text-text-muted truncate mb-1"
                       title={foto.nama_file}>
                      {foto.nama_file}
                    </p>
                    <div className="flex flex-wrap gap-0.5">
                      <StatusBadge status={foto.status_seleksi} />
                      <QualityBadges foto={foto} size="sm" showAnalyzing />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
