import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, sinceIso, fetchRepos } from '../src/fetch.mjs';

const repo = (name, last, recent, extra = {}) => ({
  name, isFork: false, isArchived: false,
  defaultBranchRef: last === undefined ? null : { target: {
    last: { nodes: last ? [{ committedDate: last }] : [] },
    recent: { totalCount: recent },
  } },
  ...extra,
});
const main = (nodes, pinned = [], total = nodes.length) => ({
  user: { pinnedItems: { nodes: pinned.map((name) => ({ name })) }, repositories: { totalCount: total, nodes } },
});
const cfg = { automated: { potato: 'relink ' } };
const SINCE = '2026-07-21T00:00:00Z';

test('since is 90 days before today', () => {
  assert.equal(sinceIso('2026-10-19'), SINCE);
});

test('normalizes pinned, fork, archived, last commit and recent count', () => {
  const out = normalize(main([
    repo('a', '2026-10-18T11:03:53Z', 16),
    repo('b', null, 0, { isFork: true }),
    repo('empty', undefined, 0, { isArchived: true }),
  ], ['b']), {}, cfg, 'U1', SINCE);
  assert.deepEqual(out, [
    { name: 'a', pinned: false, fork: false, archived: false, lastCommit: '2026-10-18', recent: 16 },
    { name: 'b', pinned: true, fork: true, archived: false, lastCommit: null, recent: 0 },
    { name: 'empty', pinned: false, fork: false, archived: true, lastCommit: null, recent: 0 },
  ]);
});

test('automated repos ignore commits with the configured prefix', () => {
  const history = [
    { committedDate: '2026-10-18T11:03:53Z', messageHeadline: 'relink 2026: follow upstream', author: { user: { id: 'U1' } } },
    { committedDate: '2026-09-06T10:00:00Z', messageHeadline: 'feat: first version', author: { user: { id: 'U1' } } },
    { committedDate: '2026-08-01T10:00:00Z', messageHeadline: 'docs: readme', author: { user: { id: 'U1' } } },
    { committedDate: '2026-07-01T10:00:00Z', messageHeadline: 'chore: start', author: { user: { id: 'U1' } } },
    { committedDate: '2026-09-01T10:00:00Z', messageHeadline: 'fix: by someone else', author: { user: { id: 'U2' } } },
  ];
  const [p] = normalize(main([repo('potato', '2026-10-18T11:03:53Z', 40)]), { potato: history }, cfg, 'U1', SINCE);
  assert.equal(p.lastCommit, '2026-09-06');
  assert.equal(p.recent, 2);
});

test('more repositories than one page fails loudly', () => {
  assert.throws(() => normalize(main([repo('a', null, 0)], [], 101), {}, cfg, 'U1', SINCE), /more than 100/);
});

test('fetchRepos asks for the user id, the main data, then each automated repo', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    assert.equal(init.headers.Authorization, 'Bearer T');
    let data;
    if (body.query.includes('pinnedItems')) data = main([repo('potato', '2026-10-18T11:03:53Z', 3), repo('a', '2026-10-01T00:00:00Z', 1)]);
    else if (body.query.includes('messageHeadline')) data = { repository: { defaultBranchRef: { target: { history: { nodes: [
      { committedDate: '2026-09-06T10:00:00Z', messageHeadline: 'feat: x', author: { user: { id: 'U1' } } },
    ] } } } } };
    else data = { user: { id: 'U1' } };
    return { ok: true, json: async () => ({ data }) };
  };
  const out = await fetchRepos({ login: 'wyrtensi', token: 'T', config: cfg, today: '2026-10-19', fetchImpl });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].variables.since, SINCE);
  assert.deepEqual(calls[2].variables, { owner: 'wyrtensi', name: 'potato' });
  assert.deepEqual(out.map((r) => [r.name, r.lastCommit]), [['potato', '2026-09-06'], ['a', '2026-10-01']]);
});

test('GraphQL errors and HTTP failures throw', async () => {
  const errors = async () => ({ ok: true, json: async () => ({ errors: [{ message: 'bad' }] }) });
  await assert.rejects(fetchRepos({ login: 'w', token: 'T', config: cfg, today: '2026-10-19', fetchImpl: errors }), /bad/);
  const http = async () => ({ ok: false, status: 502, json: async () => ({}) });
  await assert.rejects(fetchRepos({ login: 'w', token: 'T', config: cfg, today: '2026-10-19', fetchImpl: http }), /502/);
});
