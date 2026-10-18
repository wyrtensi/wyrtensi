// Reads the account's public repositories from GitHub GraphQL and turns them
// into plain records for the layout.
const API = 'https://api.github.com/graphql';
const DAY = 86400000;

export const USER_QUERY = 'query($login: String!) { user(login: $login) { id } }';

export const MAIN_QUERY = `query($login: String!, $id: ID!, $since: GitTimestamp!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name } } }
    repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER) {
      totalCount
      nodes {
        name isFork isArchived
        defaultBranchRef { target { ... on Commit {
          last: history(first: 1, author: { id: $id }) { nodes { committedDate } }
          recent: history(since: $since, author: { id: $id }) { totalCount }
        } } }
      }
    }
  }
}`;

export const AUTOMATED_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { target { ... on Commit {
      history(first: 100) { nodes { committedDate messageHeadline author { user { id } } } }
    } } }
  }
}`;

export function sinceIso(today) {
  return `${new Date(Date.parse(today) - 90 * DAY).toISOString().slice(0, 10)}T00:00:00Z`;
}

const day = (iso) => (iso ? iso.slice(0, 10) : null);

export function normalize(main, automated, config, userId, since) {
  const { pinnedItems, repositories } = main.user;
  if (repositories.totalCount > repositories.nodes.length) {
    throw new Error(`more than 100 public repositories (${repositories.totalCount}); paging is not implemented`);
  }
  const pinned = new Set(pinnedItems.nodes.map((n) => n.name));
  return repositories.nodes.map((node) => {
    const target = node.defaultBranchRef?.target;
    let lastCommit = day(target?.last?.nodes?.[0]?.committedDate);
    let recent = target?.recent?.totalCount ?? 0;
    const prefix = config.automated?.[node.name];
    if (prefix && automated[node.name]) {
      const own = automated[node.name].filter((c) =>
        c.author?.user?.id === userId && !c.messageHeadline.startsWith(prefix));
      lastCommit = day(own[0]?.committedDate);
      recent = own.filter((c) => c.committedDate >= since).length;
    }
    return { name: node.name, pinned: pinned.has(node.name), fork: node.isFork, archived: node.isArchived, lastCommit, recent };
  });
}

async function gql(query, variables, token, fetchImpl) {
  const res = await fetchImpl(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'wyrtensi-profile' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  return body.data;
}

export async function fetchRepos({ login, token, config, today, fetchImpl = fetch }) {
  const { user } = await gql(USER_QUERY, { login }, token, fetchImpl);
  const since = sinceIso(today);
  const main = await gql(MAIN_QUERY, { login, id: user.id, since }, token, fetchImpl);
  const present = new Set(main.user.repositories.nodes.map((n) => n.name));
  const automated = {};
  for (const name of Object.keys(config.automated ?? {})) {
    if (!present.has(name)) continue;
    const data = await gql(AUTOMATED_QUERY, { owner: login, name }, token, fetchImpl);
    automated[name] = data.repository?.defaultBranchRef?.target?.history?.nodes ?? [];
  }
  return normalize(main, automated, config, user.id, since);
}
