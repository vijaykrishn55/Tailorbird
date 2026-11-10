import { err, ok, type Result } from '@ra/schemas';

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface RepoInfo {
  name: string;
  fullName: string;
  description: string;
  language: string;
  topics: string[];
  pushedAt: string;
  htmlUrl: string;
  defaultBranch: string;
  fork: boolean;
  archived: boolean;
}

export interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

/** Only api.github.com and raw.githubusercontent.com are ever contacted. Public data, no token. */
export class GitHubClient {
  rateRemaining: number | undefined;
  constructor(private readonly f: FetchLike) {}

  private async get(url: string, signal?: AbortSignal): Promise<Result<{ text: string }>> {
    let res;
    try {
      res = await this.f(url, { headers: { Accept: 'application/vnd.github+json' }, signal });
    } catch (e) {
      if (signal?.aborted) return err('cancelled', 'The request was cancelled.');
      return err('network', 'Could not reach GitHub.', e instanceof Error ? e.message : String(e));
    }
    const rem = res.headers.get('x-ratelimit-remaining');
    if (rem !== null) this.rateRemaining = Number(rem);
    if (res.status === 404) return err('not_found', 'GitHub could not find that user or file.');
    if (res.status === 403 || res.status === 429)
      return err('provider_rate_limit', 'GitHub is limiting requests. Wait a few minutes and try again.');
    if (!res.ok) return err('network', `GitHub returned status ${res.status}.`);
    return ok({ text: await res.text() });
  }

  async listRepos(user: string, signal?: AbortSignal): Promise<Result<{ repos: RepoInfo[]; forks: number }>> {
    if (!/^[A-Za-z0-9-]{1,39}$/.test(user)) return err('validation', 'That is not a valid GitHub username.');
    const out: RepoInfo[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await this.get(
        `https://api.github.com/users/${user}/repos?per_page=100&type=owner&sort=pushed&page=${page}`,
        signal,
      );
      if (!r.ok) return r;
      let rows: unknown;
      try {
        rows = JSON.parse(r.value.text);
      } catch {
        return err('validation', 'GitHub sent an unreadable reply.');
      }
      if (!Array.isArray(rows)) return err('validation', 'GitHub sent an unexpected reply.');
      for (const x of rows as Record<string, unknown>[]) {
        out.push({
          name: String(x.name ?? ''),
          fullName: String(x.full_name ?? ''),
          description: String(x.description ?? ''),
          language: String(x.language ?? ''),
          topics: Array.isArray(x.topics) ? (x.topics as unknown[]).map(String) : [],
          pushedAt: String(x.pushed_at ?? ''),
          htmlUrl: String(x.html_url ?? ''),
          defaultBranch: String(x.default_branch ?? 'main'),
          fork: x.fork === true,
          archived: x.archived === true,
        });
      }
      if (rows.length < 100) break;
    }
    const named = out.filter((r) => r.name);
    return ok({ repos: named.filter((r) => !r.fork), forks: named.filter((r) => r.fork).length });
  }

  async getFile(repo: RepoInfo, path: string, signal?: AbortSignal): Promise<Result<string>> {
    const r = await this.get(
      `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}/${path}`,
      signal,
    );
    return r.ok ? ok(r.value.text) : r;
  }

  getReadme(repo: RepoInfo, signal?: AbortSignal): Promise<Result<string>> {
    return this.getFile(repo, 'README.md', signal);
  }

  async getTree(repo: RepoInfo, signal?: AbortSignal): Promise<Result<TreeEntry[]>> {
    const r = await this.get(
      `https://api.github.com/repos/${repo.fullName}/git/trees/${repo.defaultBranch}?recursive=1`,
      signal,
    );
    if (!r.ok) return r;
    try {
      const j = JSON.parse(r.value.text) as { tree?: { path: string; type: string; size?: number }[] };
      return ok(
        (j.tree ?? [])
          .filter((t) => t.type === 'blob' || t.type === 'tree')
          .map((t) => ({ path: t.path, type: t.type as 'blob' | 'tree', size: t.size })),
      );
    } catch {
      return err('validation', 'GitHub sent an unreadable file list.');
    }
  }
}
