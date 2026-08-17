/**
 * Watermark helper menggunakan Sharp SVG overlay.
 * Teks watermark diulang membentuk pola diagonal di seluruh gambar.
 */

/**
 * Membuat SVG watermark yang di-tile secara diagonal.
 * @param {number} width  - lebar gambar output
 * @param {number} height - tinggi gambar output
 * @param {string} text   - teks watermark (dari env WATERMARK_TEXT)
 * @returns {Buffer}      - SVG buffer siap dipakai sharp composite
 */
function createWatermarkSvg(width, height, text) {
  const fontSize  = Math.max(14, Math.round(width * 0.035)); // ~3.5% dari lebar
  const opacity   = 0.30;
  const spacing   = fontSize * 6;

  // Buat grid tile diagonal menggunakan defs/pattern
  const patternId = 'wm';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="${patternId}" x="0" y="0"
             width="${spacing}" height="${spacing}"
             patternUnits="userSpaceOnUse"
             patternTransform="rotate(-35)">
      <text
        x="${spacing / 2}" y="${spacing / 2}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        fill-opacity="${opacity}"
        text-anchor="middle"
        dominant-baseline="middle"
        user-select="none"
      >${escapeXml(text)}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#${patternId})" />
</svg>`.trim();

  return Buffer.from(svg);
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { createWatermarkSvg };
