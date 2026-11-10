import type { ProjectEntry } from '@ra/schemas';

export type CheckName = 'numbers' | 'tech' | 'forbidden' | 'length' | 'latex';

export interface Failure {
  bulletId: string;
  projectId: string;
  check: CheckName;
  message: string;
}

export interface CheckContext {
  /** Stored project entries by id: the only source of allowed numbers and technologies. */
  entries: Map<string, ProjectEntry>;
}

/** All text of a project entry that bullets may legitimately draw numbers and terms from. */
export function entryText(e: ProjectEntry): string {
  return [
    e.id,
    e.name ?? '',
    e.summary,
    e.readme,
    e.stackVerified.join(' '),
    ...e.metrics.map((m) => `${m.name} ${m.value} ${m.scope ?? ''}`),
    ...e.bullets.map((b) => `${b.text} ${b.keywordsSupported.join(' ')}`),
  ].join('\n');
}
