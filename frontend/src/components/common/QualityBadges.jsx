/**
 * QualityBadges — AI culling result badges
 * Design: backdrop-blur pill dengan 1px border, style cinematic dark
 */
import Spinner from './Spinner';

export default function QualityBadges({ foto, size = 'sm', showAnalyzing = true }) {
  if (!foto) return null;
  const { quality_analyzed, is_blurry, eyes_closed, face_detected, is_duplicate } = foto;

  if ((quality_analyzed === false || quality_analyzed === null) && showAnalyzing) {
    return (
      <span className="inline-flex items-center gap-1 bg-surface-container-high/80
                       border border-border-dark rounded-[2px] px-1.5 py-0.5
                       text-mono-label font-mono-label text-text-muted">
        <Spinner size={9} />
        Analyzing
      </span>
    );
  }

  const badges = [];
  if (is_blurry)                     badges.push({ dot: '#f26b3a', label: 'Blur' });
  if (face_detected && eyes_closed)  badges.push({ dot: '#9c27b0', label: 'Eyes' });
  if (is_duplicate)                  badges.push({ dot: '#ffeb3b', label: 'Similar' });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(({ dot, label }) => (
        <span key={label}
          className="inline-flex items-center gap-1 bg-[#2a2a2a]/80 border border-[#333333]
                     rounded-[2px] px-1.5 py-0.5 text-mono-label font-mono-label text-text-primary">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
          {label}
        </span>
      ))}
    </div>
  );
}
