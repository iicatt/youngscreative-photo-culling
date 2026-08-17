import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import Spinner from '../components/common/Spinner';
import api from '../services/api';

function NewSesiModal({ onClose, onCreated }) {
  const [namaSesi,  setNamaSesi]  = useState('');
  const [namaKlien, setNamaKlien] = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Req 1.1 — mode_seleksi TIDAK dikirim dari form fotografer
      const { data } = await api.post('/sesi', { nama_sesi: namaSesi, nama_klien: namaKlien });
      toast.success('Session created. Share the client link so they can choose their review mode.');
      onCreated(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create session.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
         role="dialog" aria-modal="true">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-headline-md font-headline-md text-text-primary mb-2">New Session</h2>
        <p className="text-mono-label font-mono-label text-text-muted mb-6">
          The client will choose their review mode when they open your link.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-label-sm font-label-sm text-text-muted uppercase block mb-1.5">
              Session Name
            </label>
            <input className="input" placeholder="e.g. Wedding Budi & Sari"
              value={namaSesi} onChange={(e) => setNamaSesi(e.target.value)}
              required minLength={3} />
          </div>
          <div>
            <label className="text-label-sm font-label-sm text-text-muted uppercase block mb-1.5">
              Client Name
            </label>
            <input className="input" placeholder="e.g. Budi Pratama"
              value={namaKlien} onChange={(e) => setNamaKlien(e.target.value)}
              required minLength={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate          = useNavigate();
  const queryClient       = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: sesiList, isLoading } = useQuery({
    queryKey: ['sesi'],
    queryFn: () => api.get('/sesi').then((r) => r.data),
  });

  const totals = (sesiList || []).reduce(
    (acc, s) => ({
      total:    acc.total    + (s.total_foto || 0),
      siapEdit: acc.siapEdit + (s.siap_edit  || 0),
      ditolak:  acc.ditolak  + (s.ditolak    || 0),
      revisi:   acc.revisi   + (s.revisi     || 0),
    }),
    { total: 0, siapEdit: 0, ditolak: 0, revisi: 0 }
  );

  const STATUS_MAP = {
    aktif:    <span className="chip chip-orange">Active</span>,
    selesai:  <span className="chip chip-green">Delivered</span>,
  };

  // Req 1.6 — indikator mode belum ditentukan
  function modeIndicator(sesi) {
    if (!sesi.mode_seleksi) {
      return (
        <span className="inline-flex items-center gap-1 text-yellow-400 text-mono-label font-mono-label">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
          Menunggu klien
        </span>
      );
    }
    const labels = {
      pilih_sendiri:   'Pilih Sendiri',
      oleh_fotografer: 'Dikurasi',
      lihat_saja:      'View Only',
    };
    return <span className="chip">{labels[sesi.mode_seleksi] || sesi.mode_seleksi}</span>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Navbar />

      {/* Main canvas — offset for sidebar */}
      <main className="flex-1 md:ml-64 flex flex-col">

        <div className="p-4 md:p-6 flex flex-col gap-3 max-w-[1600px] w-full mx-auto pt-16 md:pt-6">

          {/* Page title */}
          <div className="flex justify-between items-end mb-2 mt-1">
            <div>
              <h1 className="text-headline-lg font-headline-lg text-text-primary tracking-tight">
                Workspace Overview
              </h1>
              <p className="text-body-md font-body-md text-on-surface-variant mt-1">
                {sesiList?.length || 0} sessions · {totals.total} total photos
              </p>
            </div>
          </div>

          {/* Bento stats + New Session */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

            {/* Stats — 3 cells */}
            <div className="md:col-span-8 flex flex-col sm:flex-row gap-3">
              {[
                { label: 'Total Photos', val: totals.total,    icon: 'image_search',    accent: null },
                { label: 'Ready to Edit',val: totals.siapEdit, icon: 'check_circle',    accent: 'text-success' },
                { label: 'Needs Review', val: totals.ditolak + totals.revisi, icon: 'pending_actions', accent: 'text-error-container' },
              ].map(({ label, val, icon, accent }) => (
                <div key={label}
                  className="flex-1 card-hover p-4 flex flex-col justify-between group min-h-[120px]">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-widest">
                      {label}
                    </span>
                    <span className={`material-symbols-outlined text-text-muted
                                     group-hover:text-primary-container transition-colors
                                     ${accent || ''}`}
                          style={{fontSize:20}}>{icon}</span>
                  </div>
                  <span className="text-display-lg font-display-lg text-text-primary">{val}</span>
                </div>
              ))}
            </div>

            {/* New Session CTA */}
            <button onClick={() => setShowModal(true)}
              className="md:col-span-4 bg-primary-container hover:bg-inverse-primary
                         border border-primary-container text-white rounded
                         p-4 flex flex-col items-center justify-center gap-2
                         transition-all active:scale-[0.98] group relative overflow-hidden min-h-[120px]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent
                              opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="material-symbols-outlined text-4xl mb-1"
                    style={{fontVariationSettings:"'FILL' 1",fontSize:36}}>add_circle</span>
              <span className="text-headline-md font-headline-md font-bold">New Session</span>
              <span className="text-mono-label font-mono-label opacity-70">CMD + N</span>
            </button>
          </div>

          {/* Sessions table */}
          <div className="card flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3
                            border-b border-border-dark bg-surface-container-low">
              <h3 className="text-headline-md font-headline-md text-text-primary">Recent Sessions</h3>
              <button className="text-label-sm font-label-sm text-primary-container
                                 hover:text-surface-tint transition-colors flex items-center gap-1">
                View All
                <span className="material-symbols-outlined" style={{fontSize:14}}>arrow_forward</span>
              </button>
            </div>

            {isLoading && (
              <div className="flex justify-center py-12"><Spinner size={28} /></div>
            )}

            {!isLoading && (!sesiList || sesiList.length === 0) && (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-text-muted block mb-3"
                      style={{fontSize:40}}>photo_library</span>
                <p className="text-body-md font-body-md text-on-surface-variant">
                  No sessions yet. Click <strong>New Session</strong> to start.
                </p>
              </div>
            )}

            {!isLoading && sesiList && sesiList.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-dark bg-surface">
                        {['Session Name', 'Client', 'Photos', 'Ready', 'Mode', 'Status', ''].map((h) => (
                          <th key={h} className="py-2 px-4 text-mono-label font-mono-label
                                                 text-on-surface-variant uppercase tracking-widest">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark">
                      {sesiList.map((sesi) => (
                        <tr key={sesi.id}
                          className="hover:bg-surface-container-high transition-colors group cursor-pointer"
                          onClick={() => navigate(`/sesi/${sesi.id}`)}>
                          <td className="py-3 px-4">
                            <span className="text-body-md font-body-md text-text-primary font-medium">
                              {sesi.nama_sesi}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-mono-label font-mono-label text-on-surface-variant">
                            {sesi.nama_klien}
                          </td>
                          <td className="py-3 px-4 text-mono-label font-mono-label text-text-primary text-right">
                            {sesi.total_foto}
                          </td>
                          <td className="py-3 px-4 text-mono-label font-mono-label text-success text-right">
                            {sesi.siap_edit}
                          </td>
                          <td className="py-3 px-4">{modeIndicator(sesi)}</td>
                          <td className="py-3 px-4">
                            {STATUS_MAP[sesi.status_sesi] || <span className="chip">{sesi.status_sesi}</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              className="text-text-muted hover:text-text-primary transition-colors
                                         opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); navigate(`/sesi/${sesi.id}`); }}>
                              <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_forward</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden flex flex-col gap-3 p-4">
                  {sesiList.map((sesi) => (
                    <div key={sesi.id}
                      onClick={() => navigate(`/sesi/${sesi.id}`)}
                      className="card-hover p-4 flex flex-col gap-3 active:scale-[0.98] transition-transform">
                      
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-body-md font-body-md text-text-primary font-medium truncate">
                            {sesi.nama_sesi}
                          </h3>
                          <p className="text-mono-label font-mono-label text-on-surface-variant mt-0.5">
                            {sesi.nama_klien}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-text-muted shrink-0" 
                              style={{fontSize:20}}>
                          arrow_forward
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-on-surface-variant" 
                                style={{fontSize:16}}>
                            photo_library
                          </span>
                          <span className="text-mono-label font-mono-label text-text-primary">
                            {sesi.total_foto} photos
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-success" 
                                style={{fontSize:16}}>
                            check_circle
                          </span>
                          <span className="text-mono-label font-mono-label text-success">
                            {sesi.siap_edit} ready
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {modeIndicator(sesi)}
                        {STATUS_MAP[sesi.status_sesi] || <span className="chip">{sesi.status_sesi}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {showModal && (
        <NewSesiModal
          onClose={() => setShowModal(false)}
          onCreated={(newSesi) => { queryClient.invalidateQueries({ queryKey: ['sesi'] }); setShowModal(false); }}
        />
      )}
    </div>
  );
}
