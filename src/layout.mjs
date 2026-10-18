// Positions every repository around the vortex. Pure: same input, same output.
export const VIEW = { w: 840, h: 680, cx: 420, cy: 330 };
export const PALETTE = ['#2a0f1f', '#4a1626', '#7a1f2b', '#a8282c', '#c0392b', '#e0603a', '#e8743b', '#f3a46b', '#f3d2b3', '#fff1e0'];

const DAY = 86400000;
const EDGE_DAYS = 730;
const LEGEND_SPACE = 30;
const round1 = (n) => Math.round(n * 10) / 10;

// FNV-1a 32-bit over code points, scaled to [0, 1).
export function hash(name) {
  let h = 0x811c9dc5;
  for (const ch of name) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

export function daysSince(lastCommit, today) {
  if (!lastCommit) return null;
  return Math.max(1, Math.round((Date.parse(today) - Date.parse(lastCommit)) / DAY));
}

export function selectRepos(repos, profile) {
  return repos.filter((r) => r.name !== profile && (r.pinned || (!r.fork && !r.archived)));
}

const labelWidth = (name, size) => name.length * size * 0.56;

function box(name, l) {
  const w = labelWidth(name, l.size);
  const x0 = l.anchor === 'start' ? l.x : l.x - w;
  return [x0, l.y - l.size * 0.8, x0 + w, l.y + l.size * 0.25];
}

// A label may not cover any dot: its box grown by 2 units.
const dotBox = (b) => [b.x - b.r - 2, b.y - b.r - 2, b.x + b.r + 2, b.y + b.r + 2];

const overlaps = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]);

function clampLabel(name, l) {
  const w = labelWidth(name, l.size);
  let { x, y } = l;
  if (l.anchor === 'start') x = Math.min(x, VIEW.w - 8 - w);
  else x = Math.max(x, 8 + w);
  y = Math.min(Math.max(y, 14), VIEW.h - LEGEND_SPACE - l.size * 0.25);
  return { ...l, x, y };
}

function placeLabels(bodies) {
  const placed = [];
  const order = bodies
    .filter((b) => b.pinned || b.recent > 0)
    .sort((a, b) => (b.pinned - a.pinned) || (b.recent - a.recent) || a.name.localeCompare(b.name));
  for (const b of order) {
    const size = b.pinned ? 13 : 12;
    const anchor = b.x > VIEW.w * 0.8 ? 'end' : 'start';
    const x0 = anchor === 'start' ? b.x + b.r + 7 : b.x - b.r - 7;
    let chosen = null;
    let last = null;
    for (const dy of [0, -13, 13, -26, 26]) {
      const l = clampLabel(b.name, { x: x0, y: b.y + 4 + dy, anchor, size });
      last = l;
      const lb = box(b.name, l);
      if (!placed.some((p) => overlaps(p, lb)) && !bodies.some((o) => o !== b && overlaps(dotBox(o), lb))) { chosen = l; break; }
    }
    if (!chosen && b.pinned) chosen = last;
    if (chosen) {
      placed.push(box(b.name, chosen));
      b.label = { x: round1(chosen.x), y: round1(chosen.y), anchor, size };
    }
  }
}

export function layout(repos, today, { profile }) {
  const bodies = selectRepos(repos, profile).map((repo) => {
    const days = daysSince(repo.lastCommit, today);
    const f = days === null ? 1 : Math.min(1, Math.log(1 + days) / Math.log(1 + EDGE_DAYS));
    const dist = 64 + f * 236;
    const angle = hash(repo.name) * 2 * Math.PI + f * 2.2;
    return {
      name: repo.name,
      pinned: repo.pinned,
      recent: repo.recent,
      x: round1(VIEW.cx + dist * Math.cos(angle)),
      y: round1(VIEW.cy + dist * Math.sin(angle)),
      r: round1(2 + Math.min(7, 2.2 * Math.sqrt(repo.recent / 8))),
      f: Math.round(f * 1000) / 1000,
      dark: Math.max(2, 9 - Math.round(f * 8)),
      light: Math.max(1, 5 - Math.round(f * 4)),
      twinkle: days !== null && days <= 7,
      phase: Math.floor(hash(`${repo.name}#`) * 3),
      label: null,
    };
  });
  placeLabels(bodies);
  return bodies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ recent, ...body }) => body);
}
