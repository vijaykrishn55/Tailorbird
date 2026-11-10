import { canonical, canonicalSet, DICTIONARY, normalise } from '@ra/retrieval';
import {
  META_SCHEMA,
  type Fingerprint,
  type MetaFile,
  type ProjectEntry,
  type RepoCard,
  type RoleCode,
} from '@ra/schemas';
import type { RepoInfo, TreeEntry } from './github-client';

export interface Evidence {
  testFiles: number;
  hasCI: boolean;
  hasDocker: boolean;
  hasMeasured: boolean;
}

export function evidenceFromTree(tree: TreeEntry[], readme = ''): Evidence {
  const blobs = tree.filter((t) => t.type === 'blob');
  const testFiles = blobs.filter((t) =>
    /(^|\/)(test_[^/]+\.py|[^/]+\.(test|spec)\.[jt]sx?|[^/]+_test\.(py|go))$/.test(t.path),
  ).length;
  return {
    testFiles,
    hasCI: tree.some((t) => t.path.startsWith('.github/workflows/')),
    hasDocker: blobs.some((t) => /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/i.test(t.path)),
    hasMeasured: /\b(benchmark|measured|latency|p95|throughput)\b/i.test(readme) && /\d/.test(readme),
  };
}

/** Evidence grade from what can be seen in the repo: tests, CI, measured results. */
export function gradeFor(e: Evidence): RepoCard['grade'] {
  const pts = (e.testFiles >= 5 ? 2 : e.testFiles > 0 ? 1 : 0) + (e.hasCI ? 1 : 0) + (e.hasMeasured ? 1 : 0);
  return pts >= 3 ? 'A' : pts === 2 ? 'B' : pts === 1 ? 'C' : 'D';
}

const ROLE_HINTS: Record<RoleCode, string[]> = {
  AIE: [
    'LLM',
    'RAG',
    'AI Agents',
    'LangChain',
    'OpenAI',
    'Prompt Engineering',
    'Generative AI',
    'Function Calling',
    'MCP',
  ],
  MLOPS: ['vLLM', 'Prometheus', 'Grafana', 'Docker', 'Kubernetes', 'OpenTelemetry', 'KEDA'],
  BE: [
    'FastAPI',
    'Node.js',
    'Express',
    'REST API',
    'PostgreSQL',
    'Redis',
    'Django',
    'Flask',
    'Microservices',
  ],
  FS: ['React', 'Node.js', 'Next.js', 'PostgreSQL', 'REST API', 'TypeScript'],
  SDE: ['Python', 'Java', 'Git', 'SQL', 'REST API'],
  QA: ['pytest', 'Playwright', 'Selenium', 'CI/CD', 'GitHub Actions'],
  DS: ['pandas', 'scikit-learn', 'NumPy', 'PyTorch', 'TensorFlow'],
  DEVOPS: ['Docker', 'Kubernetes', 'Terraform', 'GitHub Actions', 'CI/CD', 'Linux', 'AWS'],
  SEC: ['JWT', 'OAuth'],
  FE: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'HTML', 'CSS', 'Next.js'],
  SYS: ['C', 'C++', 'Rust', 'Linux'],
};

/** First-pass role scores from stack overlap. Users can edit them; they are a starting point, not a verdict. */
export function roleScores(stack: string[]): Partial<Record<RoleCode, number>> {
  const have = canonicalSet(stack);
  const out: Partial<Record<RoleCode, number>> = {};
  for (const [role, hints] of Object.entries(ROLE_HINTS) as [RoleCode, string[]][]) {
    const hits = hints.filter((h) => have.has(canonical(h))).length;
    if (hits > 0) out[role] = Math.min(10, Math.round(3 + (hits / Math.min(hints.length, 5)) * 7));
  }
  return out;
}

export function cardFor(repo: RepoInfo, entry: ProjectEntry, ev: Evidence): RepoCard {
  const kw = [
    ...new Set([...entry.stackVerified, ...normalise(`${repo.description} ${repo.topics.join(' ')}`)]),
  ];
  const grade = gradeFor(ev);
  return {
    id: entry.id,
    tier: grade === 'A' ? 'A' : grade === 'B' || grade === 'C' ? 'B' : 'C',
    oneLine: (entry.summary || repo.description).slice(0, 160),
    roles: roleScores(kw),
    kw,
    grade,
    group: repo.topics[0] ?? (repo.language || 'general').toLowerCase(),
    pushed: repo.pushedAt.slice(0, 10),
    excluded: false,
  };
}

export function buildMeta(
  user: string,
  today: string,
  entries: { card: RepoCard; entry: ProjectEntry }[],
  fingerprints: Fingerprint[],
): MetaFile {
  return {
    schema: META_SCHEMA,
    githubUser: user,
    generatedOn: today,
    index: entries.map((e) => e.card),
    projects: entries.map((e) => e.entry),
    fingerprints,
  };
}

export const KNOWN_TERMS = DICTIONARY.length;
