import { err, ok, type Fingerprint, type MetaFile, type Result } from '@ra/schemas';
import { fingerprint } from './fingerprint';
import { GitHubClient, type RepoInfo, type TreeEntry } from './github-client';
import { heuristicEntry } from './heuristic';
import { buildMeta, cardFor, evidenceFromTree } from './meta-builder';
import { MANIFEST_RE, parseManifest } from './parse-deps';

export interface IndexOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, name: string) => void;
}

export interface IndexSummary {
  meta: MetaFile;
  total: number;
  forks: number;
  profileReadme: string;
  /** Repos where some detail (README or dependency file) could not be read. They are still included. */
  partial: string[];
}

const ROOT_MANIFESTS = ['package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml'];

const isProfileRepo = (user: string, name: string) =>
  name.toLowerCase() === user.toLowerCase() || name.toLowerCase() === '.github';

/**
 * Read every public repository and build a project bank. No model is used, so every repository is included.
 * The repository named after the user (their profile README) is not a project; its text is returned separately.
 */
export async function indexRepos(
  gh: GitHubClient,
  user: string,
  today: string,
  opts: IndexOptions = {},
): Promise<Result<IndexSummary>> {
  const list = await gh.listRepos(user, opts.signal);
  if (!list.ok) return list;
  const { repos: all, forks } = list.value;
  let profileReadme = '';
  const repos: RepoInfo[] = [];
  for (const r of all) {
    if (isProfileRepo(user, r.name)) {
      const rd = await gh.getReadme(r, opts.signal);
      if (rd.ok) profileReadme = rd.value;
    } else repos.push(r);
  }
  if (repos.length === 0) return err('not_found', 'No public repositories were found for that user.');

  const entries: Parameters<typeof buildMeta>[2] = [];
  const prints: Fingerprint[] = [];
  const partial: string[] = [];
  let i = 0;
  const concurrency = 4;
  const work = async (repo: RepoInfo) => {
    const [readme, tree] = await Promise.all([
      gh.getReadme(repo, opts.signal),
      gh.rateRemaining === undefined || gh.rateRemaining > 3
        ? gh.getTree(repo, opts.signal)
        : Promise.resolve(undefined),
    ]);
    if (!readme.ok && readme.error.code === 'cancelled') return;
    const files: TreeEntry[] = tree?.ok ? tree.value : [];
    const deps: string[] = [];
    const manifestPaths = files.length
      ? files
          .filter(
            (t) =>
              t.type === 'blob' && MANIFEST_RE.test(t.path) && !/node_modules|\/(dist|build)\//.test(t.path),
          )
          .map((t) => t.path)
          .slice(0, 4)
      : ROOT_MANIFESTS;
    let manifestFailed = false;
    for (const path of manifestPaths) {
      const c = await gh.getFile(repo, path, opts.signal);
      if (c.ok) {
        deps.push(...parseManifest(path, c.value));
        prints.push(await fingerprint(repo.name, path, c.value));
      } else if (files.length && c.error.code !== 'not_found') manifestFailed = true;
    }
    const text = readme.ok ? readme.value : '';
    if (readme.ok) prints.push(await fingerprint(repo.name, 'README.md', text));
    if (!readme.ok || manifestFailed) partial.push(repo.name);
    const ev = evidenceFromTree(files, text);
    const entry = heuristicEntry(repo, text, [...new Set(deps)], ev);
    entries.push({ entry, card: cardFor(repo, entry, ev) });
    opts.onProgress?.(++i, repos.length, repo.name);
  };
  const queue = [...repos];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        if (opts.signal?.aborted) return;
        await work(r);
      }
    }),
  );
  if (opts.signal?.aborted) return err('cancelled', 'The run was cancelled.');
  // Keep the GitHub order (most recently pushed first) regardless of which request finished first.
  const order = new Map(repos.map((r, idx) => [r.name, idx]));
  entries.sort((a, b) => (order.get(a.entry.id) ?? 0) - (order.get(b.entry.id) ?? 0));
  return ok({
    meta: buildMeta(user, today, entries, prints),
    total: all.length,
    forks,
    profileReadme,
    partial,
  });
}
