// Entry point: fetch, lay out, render both themes into dist/.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fetchRepos } from './fetch.mjs';
import { layout } from './layout.mjs';
import { renderSvg } from './render.mjs';

const root = new URL('../', import.meta.url);
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN is not set');
  process.exit(1);
}

const config = JSON.parse(await readFile(new URL('orbit.config.json', root), 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const repos = await fetchRepos({ login: config.login, token, config, today });
const bodies = layout(repos, today, { profile: config.login });
await mkdir(new URL('dist/', root), { recursive: true });
for (const theme of ['dark', 'light']) {
  const swirl = `data:image/webp;base64,${(await readFile(new URL(`assets/swirl-${theme}.webp`, root))).toString('base64')}`;
  const svg = renderSvg(bodies, { theme, swirl, legend: config.legend, title: config.title, desc: config.desc });
  await writeFile(new URL(`dist/orbit-${theme}.svg`, root), svg);
}
console.log(`orbit: ${bodies.length} repositories, ${bodies.filter((b) => b.label).length} labelled`);
