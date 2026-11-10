import MiniSearch from 'minisearch';
import type { RepoCard } from '@ra/schemas';

export interface Bm25Hit {
  id: string;
  score: number;
}

/** BM25-style full-text ranking over the short repo cards. */
export function bm25Rank(cards: RepoCard[], query: string[], limit = 20): Bm25Hit[] {
  if (cards.length === 0 || query.length === 0) return [];
  const mini = new MiniSearch<{ id: string; text: string; kw: string }>({
    fields: ['text', 'kw'],
    storeFields: [],
    searchOptions: { boost: { kw: 2 }, prefix: false, fuzzy: false, combineWith: 'OR' },
    tokenize: (t) =>
      t
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter(Boolean),
  });
  mini.addAll(cards.map((c) => ({ id: c.id, text: `${c.id} ${c.oneLine}`, kw: c.kw.join(' ') })));
  const q = query.join(' ');
  return mini
    .search(q)
    .slice(0, limit)
    .map((r) => ({ id: String(r.id), score: r.score }));
}
