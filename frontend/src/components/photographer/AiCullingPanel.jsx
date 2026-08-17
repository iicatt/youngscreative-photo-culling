import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Spinner from '../common/Spinner';
import api from '../../services/api';

export default function AiCullingPanel({ sesiId, fotoList, qSummary, onAutoSeleksi, onTriggerAll }) {
  const [open,            setOpen]            = useState(true);
  const [triggerLoading,  setTriggerLoading]  = useState(false);

  const { data: status } = useQuery({
    queryKey: ['quality-status', sesiId],
    queryFn:  () => api.get(`/sesi/${sesiId}/quality-status`).then((r) => r.data),
    refetchInterval: (q) => (!q.state.data || q.state.data.selesai_semua ? false : 4000),
    staleTime: 0,
  });

  const total    = status?.total    ?? fotoList?.length ?? 0;
  const selesai  = status?.selesai  ?? 0;
  const pending  = status?.pending  ?? fotoList?.filter((f) => !f.quality_analyzed).length ?? 0;
  const persen   = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const isDone   = status?.selesai_semua || pending === 0;
  const blurry   = status?.blurry     ?? qSummary?.blurry    ?? 0;
  const eyesCl   = status?.eyes_closed ?? qSummary?.eyes     ?? 0;
  const dup      = status?.duplicate   ?? qSummary?.duplicate ?? 0;
  const ok       = status?.ok          ?? 0;
  const masalah  = blurry + eyesCl + dup;

  async function handleTrigger() {
    setTriggerLoading(true);
    try { await onTriggerAll(); } finally { setTriggerLoading(false); }
  }

  return (
    <div className="card overflow-hidden">

      {/* Header — click to collapse */}
      <button
        className="w-full flex items-center justify-between px-4 py-3
                   hover:bg-surface-container-high transition-colors border-b border-border-dark"
        onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="flex items-center gap-3">
          {/* AI icon */}
          <div className="w-7 h-7 bg-primary-container rounded flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white" style={{fontSize:14,fontVariationSettings:"'FILL' 1"}}>
              neurology
            </span>
          </div>
          <div className="text-left">
            <p className="text-label-sm font-label-sm text-text-primary uppercase tracking-wider">
              AI Culling Analysis
            </p>
            <p className="text-mono-label font-mono-label text-text-muted mt-0.5">
              {isDone
                ? `Complete — ${masalah} issue${masalah !== 1 ? 's' : ''} found`
                : pending > 0
                  ? `${selesai}/${total} analyzed (${persen}%)`
                  : 'No photos analyzed yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isDone && pending > 0 && <Spinner size={14} />}
          {isDone && (
            <span className="material-symbols-outlined text-success" style={{fontSize:16,fontVariationSettings:"'FILL' 1"}}>
              check_circle
            </span>
          )}
          <span className="material-symbols-outlined text-text-muted" style={{fontSize:16}}>
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 flex flex-col gap-4">

          {/* Progress bar */}
          {total > 0 && (
            <div>
              <div className="flex justify-between text-mono-label font-mono-label mb-1.5">
                <span className="text-text-muted">
                  {isDone ? 'Analysis complete' : pending > 0 ? `Analyzing ${pending} photos…` : 'Waiting'}
                </span>
                <span className="text-text-primary font-medium">{persen}%</span>
              </div>
              <div className="h-[3px] bg-surface-container-highest w-full overflow-hidden rounded-full relative">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${isDone ? 'bg-success' : 'bg-primary-container'}`}
                  style={{ width: `${persen}%` }}>
                  {!isDone && pending > 0 && (
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="h-full w-1/3 bg-white/25 absolute
                                      animate-[bounce-x_1.8s_infinite_alternate_ease-in-out]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: 'check_circle', label: 'Clean',       val: ok,      color: 'text-success',    fill: true },
                { icon: 'blur_on',      label: 'Blur',        val: blurry,  color: 'text-primary-container', fill: false },
                { icon: 'visibility_off',label: 'Eyes Closed',val: eyesCl,  color: 'text-purple-400', fill: false },
                { icon: 'content_copy', label: 'Similar',     val: dup,     color: 'text-yellow-400', fill: false },
              ].map(({ icon, label, val, color, fill }) => (
                <div key={label} className="card p-3 text-center group hover:border-outline-variant transition-colors">
                  <span className={`material-symbols-outlined mb-1 block ${color}`}
                        style={{fontSize:18, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0"}}>
                    {icon}
                  </span>
                  <p className="text-headline-md font-headline-md text-text-primary">{val}</p>
                  <p className="text-mono-label font-mono-label text-text-muted mt-0.5 uppercase tracking-widest">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {isDone && masalah > 0 && (
              <button onClick={onAutoSeleksi}
                className="btn-primary text-xs py-2">
                <span className="material-symbols-outlined" style={{fontSize:14,fontVariationSettings:"'FILL' 1"}}>
                  auto_fix_high
                </span>
                Mark {masalah} Issues as Revision
              </button>
            )}
            <button onClick={handleTrigger} disabled={triggerLoading}
              className="btn-secondary text-xs py-2">
              {triggerLoading
                ? <><Spinner size={12} /> Scheduling…</>
                : <><span className="material-symbols-outlined" style={{fontSize:14}}>refresh</span>
                    Re-analyze All</>
              }
            </button>
          </div>

          {/* Warning if service not running */}
          {total > 0 && pending > 0 && !status && (
            <div className="card p-3 border-outline-variant">
              <p className="text-mono-label font-mono-label text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary-container" style={{fontSize:14}}>
                  warning
                </span>
                Photo Quality Service not running — start it on port 6000.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
