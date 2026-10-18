import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW, PALETTE, hash, daysSince, selectRepos, layout } from '../src/layout.mjs';

const rec = (name, lastCommit, recent = 0, extra = {}) =>
  ({ name, pinned: false, fork: false, archived: false, lastCommit, recent, ...extra });
const dist = (b) => Math.hypot(b.x - VIEW.cx, b.y - VIEW.cy);
const TODAY = '2026-10-19';

test('hash is FNV-1a scaled to [0,1) and stable', () => {
  assert.equal(hash('a'), 0xe40c292c / 2 ** 32);
  assert.equal(hash('wystore'), hash('wystore'));
  assert.ok(hash('x') >= 0 && hash('x') < 1);
});

test('daysSince counts whole UTC days, minimum 1, null stays null', () => {
  assert.equal(daysSince('2026-10-19', TODAY), 1);
  assert.equal(daysSince('2026-10-09', TODAY), 10);
  assert.equal(daysSince(null, TODAY), null);
});

test('selection drops forks, archived and the profile repo unless pinned', () => {
  const got = selectRepos([
    rec('own', TODAY), rec('fork', TODAY, 0, { fork: true }),
    rec('old', TODAY, 0, { archived: true }), rec('pinfork', TODAY, 0, { fork: true, pinned: true }),
    rec('pinold', TODAY, 0, { archived: true, pinned: true }), rec('wyrtensi', TODAY),
  ], 'wyrtensi').map((r) => r.name).sort();
  assert.deepEqual(got, ['own', 'pinfork', 'pinold']);
});

test('fresher is closer, no commit sits on the outer edge', () => {
  const [a, b, c] = layout([rec('a', '2026-10-18'), rec('b', '2025-10-18'), rec('c', null)], TODAY, { profile: 'wyrtensi' });
  assert.ok(dist(a) < dist(b));
  assert.ok(Math.abs(dist(c) - 300) < 0.2);
  assert.equal(c.f, 1);
});

test('more recent commits make a bigger dot, capped at 9', () => {
  const [a, b, c] = layout([rec('a', TODAY, 0), rec('b', TODAY, 30), rec('c', TODAY, 10000)], TODAY, { profile: 'w' });
  assert.equal(a.r, 2);
  assert.ok(b.r > a.r);
  assert.equal(c.r, 9);
});

test('angle is fixed per name: same repo, same direction at the same age', () => {
  const one = layout([rec('wystore', '2026-10-01')], TODAY, { profile: 'w' })[0];
  const two = layout([rec('wystore', '2026-10-01'), rec('other', TODAY)], TODAY, { profile: 'w' }).find((b) => b.name === 'wystore');
  assert.deepEqual([one.x, one.y], [two.x, two.y]);
});

test('colours, twinkle and phase follow the spec', () => {
  const [fresh, old] = layout([rec('fresh', '2026-10-15'), rec('old', null)], TODAY, { profile: 'w' });
  assert.equal(fresh.twinkle, true);
  assert.equal(old.twinkle, false);
  assert.equal(old.dark, 2);
  assert.equal(old.light, 1);
  assert.equal(fresh.dark, Math.max(2, 9 - Math.round(fresh.f * 8)));
  assert.ok([0, 1, 2].includes(fresh.phase));
  assert.equal(PALETTE.length, 10);
});

test('labels: pinned always, active ones when they fit, idle ones never', () => {
  const bodies = layout([
    rec('pinned-idle', null, 0, { pinned: true }), rec('active', TODAY, 5), rec('idle', '2025-01-01', 0),
  ], TODAY, { profile: 'w' });
  const by = Object.fromEntries(bodies.map((b) => [b.name, b]));
  assert.ok(by['pinned-idle'].label);
  assert.equal(by['pinned-idle'].label.size, 13);
  assert.ok(by.active.label);
  assert.equal(by.active.label.size, 12);
  assert.equal(by.idle.label, null);
});

test('drawn labels never overlap and stay inside the canvas', () => {
  const many = Array.from({ length: 40 }, (_, i) => rec(`repo-number-${i}`, '2026-10-18', 3));
  const boxes = layout(many, TODAY, { profile: 'w' }).filter((b) => b.label).map(({ name, label: l }) => {
    const w = name.length * l.size * 0.56;
    const x0 = l.anchor === 'start' ? l.x : l.x - w;
    return [x0, l.y - l.size * 0.8, x0 + w, l.y + l.size * 0.25];
  });
  for (const [x0, y0, x1, y1] of boxes) {
    assert.ok(x0 >= 0 && x1 <= VIEW.w && y0 >= 0 && y1 <= VIEW.h - 30);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `overlap ${i} ${j}`);
  }
});

test('output is sorted by name, rounded, and deterministic', () => {
  const input = [rec('b', '2026-09-01', 4), rec('a', '2026-10-01', 9, { pinned: true })];
  const one = layout(input, TODAY, { profile: 'w' });
  assert.deepEqual(one.map((b) => b.name), ['a', 'b']);
  assert.deepEqual(one, layout([...input].reverse(), TODAY, { profile: 'w' }));
  for (const b of one) assert.equal(b.x, Math.round(b.x * 10) / 10);
});
