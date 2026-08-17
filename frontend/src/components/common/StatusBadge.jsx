const CONFIG = {
  belum_ditinjau: { label: 'Unreviewed', cls: 'chip' },
  siap_edit:      { label: 'Ready',      cls: 'chip chip-green' },
  ditolak:        { label: 'Rejected',   cls: 'chip chip-error' },
  revisi:         { label: 'Revision',   cls: 'chip chip-yellow' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.belum_ditinjau;
  return <span className={cfg.cls}>{cfg.label}</span>;
}
