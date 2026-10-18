import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { layout } from '../src/layout.mjs';
import { renderSvg, THEMES } from '../src/render.mjs';

const rec = (name, lastCommit, recent = 0, extra = {}) =>
  ({ name, pinned: false, fork: false, archived: false, lastCommit, recent, ...extra });
const bodies = layout([
  rec('wystore', '2026-10-18', 16, { pinned: true }), rec('stats', '2026-10-18', 30),
  rec('old<&>', '2025-04-03', 0, { pinned: true }), rec('MailExpert', '2026-10-16', 100, { pinned: true, fork: true }),
], '2026-10-19', { profile: 'wyrtensi' });
const opts = (theme, swirl = 'data:image/webp;base64,AAAA') =>
  ({ theme, swirl, legend: 'closer: fresher', title: 'T', desc: 'D' });

test('animation, reduced motion and no scripts', () => {
  const svg = renderSvg(bodies, opts('dark'));
  assert.match(svg, /@keyframes spin/);
  assert.match(svg, /@keyframes tw/);
  assert.match(svg, /@media \(prefers-reduced-motion: ?reduce\)/);
  assert.match(svg, /animation:\s*spin 120s linear infinite/);
  assert.ok(!/<script/i.test(svg));
});

test('the only reference is the embedded swirl', () => {
  const svg = renderSvg(bodies, opts('dark'));
  const refs = [...svg.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(refs, ['data:image/webp;base64,AAAA']);
});

test('one dot per body, rings for pinned, labels escaped', () => {
  const svg = renderSvg(bodies, opts('dark'));
  assert.equal((svg.match(/class="dot/g) || []).length, bodies.length);
  assert.equal((svg.match(/class="ring"/g) || []).length, 3);
  assert.ok(svg.includes('>wystore<'));
  assert.ok(svg.includes('>old&lt;&amp;&gt;<'));
  assert.ok(!svg.includes('old<&>'));
});

test('title, desc and legend are present', () => {
  const svg = renderSvg(bodies, opts('light'));
  assert.match(svg, /<title id="t">T<\/title>/);
  assert.match(svg, /<desc id="d">D<\/desc>/);
  assert.ok(svg.includes('>closer: fresher<'));
  assert.ok(svg.includes(THEMES.light.bg));
});

test('a static radial fade in the theme background sits between the swirl and the dots', () => {
  const svg = renderSvg(bodies, opts('light'));
  assert.match(svg, /<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="420" cy="330" r="380">/);
  const image = svg.indexOf('<image');
  const fade = svg.indexOf('fill="url(#fade)"');
  const firstDot = svg.indexOf('class="dot');
  assert.ok(image > 0 && image < fade && fade < firstDot);
  assert.ok(svg.includes(`stop-color="${THEMES.light.bg}"`));
});

test('light and dark differ only in colours', () => {
  const strip = (s) => s.replace(/#[0-9a-f]{6}/gi, '#');
  assert.equal(strip(renderSvg(bodies, opts('dark'))), strip(renderSvg(bodies, opts('light'))));
  assert.notEqual(renderSvg(bodies, opts('dark')), renderSvg(bodies, opts('light')));
});

test('with the real swirl the image stays within 250 000 bytes', async () => {
  const webp = await readFile(new URL('../assets/swirl-light.webp', import.meta.url));
  const svg = renderSvg(bodies, opts('dark', `data:image/webp;base64,${webp.toString('base64')}`));
  assert.ok(Buffer.byteLength(svg) <= 250000, `size ${Buffer.byteLength(svg)}`);
});

test('labels have a halo and dots an outline in the theme background', () => {
  for (const theme of ['dark', 'light']) {
    const svg = renderSvg(bodies, opts(theme));
    const bg = THEMES[theme].bg;
    const halos = [...svg.matchAll(/<text [^>]*paint-order="stroke"[^>]*>/g)].map((m) => m[0]);
    assert.equal(halos.length, bodies.filter((b) => b.label).length);
    for (const tag of halos) {
      assert.ok(tag.includes(`stroke="${bg}"`) && tag.includes('stroke-width="3"') && tag.includes('stroke-opacity=".85"') && tag.includes('stroke-linejoin="round"'), tag);
    }
    const dots = [...svg.matchAll(/<circle class="dot[^>]*>/g)].map((m) => m[0]);
    assert.equal(dots.length, bodies.length);
    for (const tag of dots) assert.ok(tag.includes(`stroke="${bg}"`) && tag.includes('stroke-width="1.5"'), tag);
    const legend = svg.slice(svg.lastIndexOf('<text'));
    assert.ok(!legend.includes('paint-order'), 'legend has no halo');
  }
});
