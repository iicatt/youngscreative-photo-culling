/**
 * KlienLanding.jsx — v3
 * =====================
 * Req 1: Mode dipilih klien, disimpan permanen ke DB.
 * - Jika mode sudah ada di DB → langsung redirect ke galeri
 * - Jika fase pra_edit → sembunyikan "Lihat-Lihat"
 * - Pilihan disimpan via PATCH /api/klien/:token/pilih-mode
 */
import { useState }        from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery }        from '@tanstack/react-query';
import toast               from 'react-hot-toast';
import Spinner             from '../components/common/Spinner';
import api                 from '../services/api';

export default function KlienLanding() {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['klien-info', token],
    queryFn:  () => api.get(`/klien/${token}/foto`).then((r) => r.data),
    retry:    false,
    staleTime: 5 * 60 * 1000,
  });

  // Req 1.5 — jika mode sudah dipilih sebelumnya, langsung ke galeri
  if (!isLoading && data?.sesi?.mode_seleksi) {
    navigate(`/k/${token}/galeri`, { replace: true });
    return null;
  }

  async function pilih(mode) {
    setSaving(true);
    try {
      await api.patch(`/klien/${token}/pilih-mode`, { mode_seleksi: mode });
      navigate(`/k/${token}/galeri`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal menyimpan pilihan.';
      // Jika mode sudah dipilih (409) → tetap lanjut ke galeri
      if (err.response?.status === 409) {
        navigate(`/k/${token}/galeri`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size={32} />
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="card p-10 text-center max-w-sm">
        <span className="material-symbols-outlined text-text-muted block mb-3"
              style={{fontSize:48}}>image_not_supported</span>
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-text-primary mb-2">
          Session Not Found
        </h1>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Tautan tidak valid, sudah kedaluwarsa, atau sesi telah ditutup.
        </p>
      </div>
    </div>
  );

  const { sesi, foto } = data;
  const totalFoto  = foto?.length ?? 0;
  const sudah      = foto?.filter((f) => f.status_seleksi !== 'belum_ditinjau').length ?? 0;
  const isPraEdit  = sesi.fase_sesi === 'pra_edit' || !sesi.fase_sesi;

  // Req 2.2 — di fase pra_edit, lihat_saja tidak tersedia
  const MODES = [
    {
      key:    'pilih_sendiri',
      span:   'md:col-span-12',
      minH:   'min-h-[300px] md:min-h-[380px]',
      label:  'Pilih Sendiri',
      tag:    'Full Selection',
      tagCls: 'text-primary-container',
      desc:   'Tinjau seluruh tangkapan dan pilih momen favorit Anda secara manual. Direkomendasikan jika Anda ingin kendali penuh.',
      icon:   'imagesmode',
      grad:   'from-primary-container/20',
    },
    {
      key:    'oleh_fotografer',
      span:   'md:col-span-6',
      minH:   'min-h-[220px] md:min-h-[280px]',
      label:  'Sudah Dipilihkan',
      tag:    "Curator's Pick",
      tagCls: 'text-secondary',
      desc:   'Tinjau shortlist yang telah dikurasi fotografer. Cara tercepat.',
      icon:   'stars',
      grad:   'from-secondary/15',
    },
    !isPraEdit && {
      key:    'lihat_saja',
      span:   'md:col-span-6',
      minH:   'min-h-[220px] md:min-h-[280px]',
      label:  'Lihat-Lihat',
      tag:    'View Only',
      tagCls: 'text-on-surface',
      desc:   'Nikmati seluruh koleksi foto tanpa kewajiban memilih.',
      icon:   'gallery_thumbnail',
      grad:   'from-surface-container/50',
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background flex justify-center items-center py-8">
      <main className="w-full max-w-6xl px-4 md:px-6">

        {/* Header */}
        <header className="mb-10 md:mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary-container"
                  style={{fontSize:18}}>photo_camera</span>
            <span className="text-mono-label font-mono-label text-on-surface-variant uppercase tracking-widest">
              CFC — Culling Foto Creative
            </span>
            {/* Fase badge */}
            {isPraEdit && (
              <span className="chip chip-orange ml-2">Pra-Edit</span>
            )}
          </div>
          <h1 className="text-headline-lg-mobile md:text-display-lg font-display-lg
                         text-surface-light tracking-tight mb-2">
            Halo, {sesi.nama_klien}
          </h1>
          <p className="text-body-lg font-body-lg text-text-muted max-w-2xl">
            Koleksi momen Anda untuk sesi{' '}
            <strong className="text-on-surface-variant">{sesi.nama_sesi}</strong> telah siap.
            {isPraEdit
              ? ' Pilih cara Anda meninjau dan memilih foto.'
              : ' Foto hasil editan sudah tersedia — pilih cara Anda mengaksesnya.'}
          </p>

          {/* Progress ringkasan */}
          {totalFoto > 0 && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-mono-label font-mono-label text-on-surface-variant">
                {totalFoto} foto
              </span>
              {sudah > 0 && (
                <>
                  <span className="text-border-dark">·</span>
                  <span className="text-mono-label font-mono-label text-on-surface-variant">
                    {sudah} ditinjau
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-px bg-border-dark relative">
                      <div className="absolute left-0 top-0 h-full bg-primary-container"
                           style={{ width: `${Math.round(sudah/totalFoto*100)}%` }} />
                    </div>
                    <span className="text-mono-label font-mono-label text-primary-container">
                      {Math.round(sudah/totalFoto*100)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Info pra_edit: download dinonaktifkan */}
          {isPraEdit && (
            <div className="mt-4 card p-3 flex items-center gap-2 border-outline-variant max-w-xl">
              <span className="material-symbols-outlined text-on-surface-variant shrink-0"
                    style={{fontSize:16}}>info</span>
              <p className="text-mono-label font-mono-label text-on-surface-variant">
                Fase Pra-Edit — Anda hanya dapat meninjau dan memilih foto.
                Unduhan foto asli akan tersedia setelah fotografer selesai mengedit.
              </p>
            </div>
          )}
        </header>

        {/* Mode cards grid */}
        {saving ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <Spinner size={36} />
            <p className="text-body-md font-body-md text-on-surface-variant">
              Menyimpan pilihan…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {MODES.map((m) => (
              <button key={m.key} onClick={() => pilih(m.key)}
                className={`${m.span} group relative overflow-hidden rounded border border-border-dark
                             bg-surface-dark transition-all duration-300 hover:border-primary-container
                             cursor-pointer ${m.minH} flex flex-col justify-end text-left`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${m.grad} via-surface-dark
                                 to-surface-dark opacity-60 group-hover:opacity-80 transition-opacity`} />
                <div className="absolute inset-0 grid-overlay" />
                <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row
                                md:items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`material-symbols-outlined ${m.tagCls}`}
                            style={{fontSize:16}}>{m.icon}</span>
                      <span className={`text-mono-label font-mono-label uppercase tracking-widest ${m.tagCls}`}>
                        {m.tag}
                      </span>
                    </div>
                    <h2 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg
                                   text-surface-light mb-2 group-hover:text-primary transition-colors">
                      {m.label}
                    </h2>
                    <p className="text-body-md font-body-md text-on-surface-variant">{m.desc}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-border-dark flex items-center
                                  justify-center bg-surface/50 group-hover:bg-primary-container
                                  group-hover:border-primary-container transition-all shrink-0">
                    <span className="material-symbols-outlined text-surface-light"
                          style={{fontSize:18}}>arrow_forward</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-mono-label font-mono-label text-text-muted/50 mt-8">
          Pilihan mode bersifat permanen untuk sesi ini.
        </p>
      </main>
    </div>
  );
}
