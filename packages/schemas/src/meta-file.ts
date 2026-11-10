import { z } from 'zod';
import { RoleCode } from './job-profile';
import { MetricStatus } from './bullet';
import { err, ok, type Result } from './errors';

export const RepoCard = z.object({
  id: z.string().min(1),
  tier: z.enum(['A', 'B', 'C']),
  oneLine: z.string(),
  roles: z.record(RoleCode, z.number().min(0).max(10)).default({}),
  kw: z.array(z.string()).default([]),
  grade: z.enum(['A', 'B', 'C', 'D']),
  group: z.string().default('general'),
  pushed: z.string().default(''),
  /** Hidden from ranking by the user. */
  excluded: z.boolean().default(false),
});
export type RepoCard = z.infer<typeof RepoCard>;

export const MetricEntry = z.object({
  name: z.string(),
  value: z.string(),
  status: MetricStatus,
  scope: z.string().optional(),
});

export const BulletEntry = z.object({
  id: z.string(),
  text: z.string(),
  angle: z.string().default(''),
  keywordsSupported: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  metricStatus: MetricStatus.default('none'),
});

export const ProjectEntry = z.object({
  id: z.string().min(1),
  url: z.string().default(''),
  name: z.string().optional(),
  year: z.string().default(''),
  summary: z.string().default(''),
  /** A trimmed excerpt of the README. Numbers and technologies in it count as supported facts. */
  readme: z.string().default(''),
  stackVerified: z.array(z.string()).default([]),
  metrics: z.array(MetricEntry).default([]),
  bullets: z.array(BulletEntry).default([]),
  doNotClaim: z.array(z.string()).default([]),
  ratingBasis: z.string().default(''),
  liveCheck: z.array(z.string()).default([]),
});
export type ProjectEntry = z.infer<typeof ProjectEntry>;

export const Fingerprint = z.object({ repo: z.string(), file: z.string(), sha256_12: z.string() });
export type Fingerprint = z.infer<typeof Fingerprint>;

export const META_SCHEMA = 'resume-meta/1.0' as const;

export const MetaFile = z.object({
  schema: z.literal(META_SCHEMA),
  githubUser: z.string(),
  generatedOn: z.string(),
  index: z.array(RepoCard),
  projects: z.array(ProjectEntry),
  fingerprints: z.array(Fingerprint).default([]),
});
export type MetaFile = z.infer<typeof MetaFile>;

export function parseMetaFile(json: string | unknown): Result<MetaFile> {
  let data: unknown = json;
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json);
    } catch {
      return err('validation', 'The file is not valid JSON.');
    }
  }
  if (
    data &&
    typeof data === 'object' &&
    'schema' in data &&
    (data as { schema: unknown }).schema !== META_SCHEMA
  ) {
    return err(
      'unsupported',
      `Unsupported meta-file version: ${String((data as { schema: unknown }).schema)}.`,
    );
  }
  const parsed = MetaFile.safeParse(data);
  if (!parsed.success)
    return err('validation', 'The meta file does not match the expected format.', parsed.error.message);
  return ok(parsed.data);
}

export function serializeMetaFile(meta: MetaFile): string {
  return JSON.stringify(MetaFile.parse(meta), null, 2);
}

export const emptyMeta = (githubUser: string, generatedOn: string): MetaFile => ({
  schema: META_SCHEMA,
  githubUser,
  generatedOn,
  index: [],
  projects: [],
  fingerprints: [],
});
