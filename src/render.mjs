// Draws the orbit image for one theme. Pure: bodies in, SVG string out.
import { VIEW, PALETTE } from './layout.mjs';

export const THEMES = {
  dark: { bg: '#0d1117', ring: '#f3d2b3', pin: '#ffe8cc', label: '#c9a99a', legend: '#8a7470', dot: (b) => PALETTE[b.dark] },
  light: { bg: '#fbf6f0', ring: '#7a1f2b', pin: '#4a1626', label: '#7a1f2b', legend: '#8a6a60', dot: (b) => PALETTE[b.light] },
};

const SWIRL = 520;
// The swirl is an opaque square; this fade hides its corners while it turns
// and any colour drift from lossy compression. Past FADE_TO it is pure background.
const FADE_FROM = 250;
const FADE_TO = 270;
const FADE_R = 380;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = '@keyframes spin{to{transform:rotate(360deg)}}'
  + '@keyframes tw{50%{opacity:.45}}'
  + '.swirl{transform-box:fill-box;transform-origin:center;animation:spin 120s linear infinite}'
  + '.tw{animation:tw 3s ease-in-out infinite}.p1{animation-delay:-1s}.p2{animation-delay:-2s}'
  + '@media (prefers-reduced-motion: reduce){.swirl,.tw{animation:none}}'
  + 'text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}';

export function renderSvg(bodies, { theme, swirl, legend, title, desc }) {
  const t = THEMES[theme];
  const { w, h, cx, cy } = VIEW;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">`);
  out.push(`<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>`);
  out.push(`<style>${STYLE}</style>`);
  out.push('<defs><radialGradient id="hole"><stop offset="0" stop-color="#020203"/><stop offset=".6" stop-color="#060509"/><stop offset="1" stop-color="#060509" stop-opacity="0"/></radialGradient>'
    + `<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${FADE_R}">`
    + `<stop offset="${(FADE_FROM / FADE_R).toFixed(3)}" stop-color="${t.bg}" stop-opacity="0"/>`
    + `<stop offset="${(FADE_TO / FADE_R).toFixed(3)}" stop-color="${t.bg}"/></radialGradient></defs>`);
  out.push(`<rect width="${w}" height="${h}" rx="16" fill="${t.bg}"/>`);
  out.push(`<g class="swirl"><image href="${swirl}" x="${cx - SWIRL / 2}" y="${cy - SWIRL / 2}" width="${SWIRL}" height="${SWIRL}"/></g>`);
  out.push(`<rect width="${w}" height="${h}" rx="16" fill="url(#fade)"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="44" fill="url(#hole)"/>`);
  for (const b of bodies) {
    if (b.pinned) out.push(`<circle class="ring" cx="${b.x}" cy="${b.y}" r="${(b.r + 4).toFixed(1)}" fill="none" stroke="${t.ring}" stroke-opacity=".7"/>`);
    const tw = b.twinkle ? ` tw${b.phase ? ` p${b.phase}` : ''}` : '';
    out.push(`<circle class="dot${tw}" cx="${b.x}" cy="${b.y}" r="${b.r}" fill="${t.dot(b)}" stroke="${t.bg}" stroke-width="1.5"/>`);
  }
  for (const b of bodies) {
    if (!b.label) continue;
    const l = b.label;
    out.push(`<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" font-size="${l.size}" fill="${b.pinned ? t.pin : t.label}" stroke="${t.bg}" stroke-width="3" stroke-opacity=".85" stroke-linejoin="round" paint-order="stroke">${esc(b.name)}</text>`);
  }
  out.push(`<text x="${cx}" y="${h - 14}" text-anchor="middle" font-size="12" fill="${t.legend}">${esc(legend)}</text>`);
  out.push('</svg>');
  return `${out.join('')}\n`;
}
