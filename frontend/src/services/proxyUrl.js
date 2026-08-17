/**
 * proxyUrl.js — Helper URL Image Proxy
 * ======================================
 * Default fmt=webp → thumbnail lebih kecil ~30% dari JPEG.
 * Semua browser modern mendukung WebP.
 */
const PROXY_BASE = import.meta.env.VITE_PROXY_URL || '';

export function proxyUrl(bucket, objectKey, opts = {}) {
  if (!bucket || !objectKey) return '';

  const {
    preset = 'thumb',
    w, h,
    wm  = true,
    fmt = 'webp',   // default WebP
    q,              // pakai default preset jika tidak diisi
  } = opts;

  const p = new URLSearchParams();
  if (preset) p.set('preset', preset);
  else {
    if (w) p.set('w', String(w));
    if (h) p.set('h', String(h));
  }
  p.set('wm', wm ? '1' : '0');
  p.set('fmt', fmt);
  if (q) p.set('q', String(q));

  return `${PROXY_BASE}/proxy/${bucket}/${objectKey}?${p.toString()}`;
}
