// One-off: draws the vortex as SVG and converts it to one opaque WebP per
// theme, with the theme background baked in (alpha would triple the size).
// Run with `npm run swirl` only when the vortex itself should change.
// The backgrounds must match THEMES in src/render.mjs.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 780;
const PALETTE = ['#2a0f1f', '#4a1626', '#7a1f2b', '#a8282c', '#c0392b', '#e0603a', '#e8743b', '#f3a46b', '#f3d2b3', '#fff1e0'];
const BACKGROUNDS = { dark: '#0d1117', light: '#fbf6f0' };
const QUALITY = 78;
const STREAKS = 320;
const S = SIZE / 2 / 230;

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const paths = [];
for (let i = 0; i < STREAKS; i++) {
  const a0 = rnd() * Math.PI * 2;
  const len = 1.2 + rnd() * 2.6;
  const rs = 28 + rnd() * 130;
  const grow = 12 + rnd() * 28;
  const near = 1 - Math.min(1, rs / 160);
  const color = PALETTE[Math.min(9, Math.floor((near * 0.7 + rnd() * 0.45) * 10))];
  const opacity = (0.25 + rnd() * 0.55).toFixed(2);
  const width = ((0.5 + rnd() * 2.6) * S).toFixed(2);
  let d = '';
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const a = a0 + t * len;
    const rad = Math.min(225, rs + t * grow * len) * S;
    d += `${k ? 'L' : 'M'}${(Math.cos(a) * rad).toFixed(1)} ${(Math.sin(a) * rad).toFixed(1)}`;
  }
  paths.push(`<path d="${d}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`);
}

const streaks = `<g transform="translate(${SIZE / 2} ${SIZE / 2})" fill="none" stroke-linecap="round">${paths.join('')}</g>`;
const svg = (background) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">`
  + (background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` : '')
  + `${streaks}</svg>\n`;

const dir = new URL('../assets/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('swirl.svg', dir), svg(null));
for (const [theme, background] of Object.entries(BACKGROUNDS)) {
  const file = fileURLToPath(new URL(`swirl-${theme}.webp`, dir));
  const info = await sharp(Buffer.from(svg(background))).webp({ quality: QUALITY, effort: 6 }).toFile(file);
  console.log(`swirl-${theme}.webp ${info.width}x${info.height}, ${info.size} bytes`);
}
