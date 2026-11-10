import { coverageReport, runChecks } from '@ra/verify';
import {
  err,
  ok,
  type Bullet,
  type JobProfile,
  type MetaFile,
  type Profile,
  type ProjectEntry,
  type ResumeDraft,
  type Result,
} from '@ra/schemas';
import type { Deps } from './ports';
import { analyzeJob } from './stages/analyze-job';
import { generateProject } from './stages/generate-bullets';
import { rankProjects } from './stages/rank-projects';
import { tailorResume } from './stages/tailor';
import { Trace } from './trace';
import type { OwnProject } from './docs';

const key = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fold what the person already wrote about a project (their bullets, name and stack) into its entry as supported facts. */
function withOwn(entry: ProjectEntry, own?: OwnProject): ProjectEntry {
  if (!own) return entry;
  const stack = [...new Set([...own.stack, ...entry.stackVerified])];
  return {
    ...entry,
    name: own.name || entry.name,
    stackVerified: stack,
    readme: `${own.stack.length ? `Stack: ${own.stack.join(', ')}. ` : ''}${entry.readme}`,
    bullets: [
      ...own.bullets.map((text, i) => ({
        id: `${entry.id}.own${i + 1}`,
        text,
        angle: '',
        keywordsSupported: [],
        evidence: [],
        metricStatus: 'none' as const,
      })),
      ...entry.bullets,
    ],
  };
}

export interface RunInput {
  jobText: string;
  meta: MetaFile;
  profile: Profile;
  /** Plain text of the user's own documents. Used to check that nothing new is claimed. */
  corpus?: string;
  /** Section order learned from the user's own resume. */
  order?: string[];
  /** Projects the person already wrote up in their own resume. */
  own?: OwnProject[];
  count?: number;
}

export interface RunOutput {
  job: JobProfile;
  picks: { id: string; reason: string }[];
  draft: ResumeDraft;
  coverage: ReturnType<typeof coverageReport>;
  notes: string[];
  trace: Trace;
}

/** Analyse the job, pick projects, write and verify bullets, tailor the rest of the resume. Rendering is separate. */
export async function runPipeline(deps: Deps, input: RunInput): Promise<Result<RunOutput>> {
  const trace = new Trace();
  const cancelled = () => deps.signal?.aborted === true;
  const job = await analyzeJob(deps, input.jobText);
  if (!job.ok) return job;
  trace.record('analyse', `${job.value.roleCode}`, { must: job.value.mustHave });
  deps.emit?.({ type: 'partial', stage: 'analyse', data: job.value });
  if (cancelled()) return err('cancelled', 'The run was cancelled.');

  const ranked = await rankProjects(deps, input.meta, job.value, input.count ?? 3);
  if (!ranked.ok) return ranked;
  trace.record('rank', undefined, ranked.value);

  const ownBy = new Map((input.own ?? []).map((o) => [key(o.repo), o]));
  const entries = new Map<string, ProjectEntry>(
    input.meta.projects.map((p) => [p.id, withOwn(p, ownBy.get(key(p.id)))]),
  );
  // The projects are independent, so they are written at the same time.
  let finished = 0;
  const results = await Promise.all(
    ranked.value.map(async (pick) => {
      const entry = entries.get(pick.id);
      if (!entry) return undefined;
      const p = await generateProject(deps, entry, job.value);
      deps.emit?.({
        type: 'progress',
        stage: 'generate',
        message: `Wrote bullets for ${entry.name ?? entry.id}`,
        done: ++finished,
        total: ranked.value.length,
      });
      if (p.ok) deps.emit?.({ type: 'partial', stage: 'generate', data: p.value });
      return { pick, p };
    }),
  );
  if (cancelled()) return err('cancelled', 'The run was cancelled.');
  const projects = [];
  for (const r of results) {
    if (!r) continue;
    if (!r.p.ok) {
      if (r.p.error.code === 'cancelled' || r.p.error.code === 'provider_auth') return r.p;
      trace.record('generate', `failed ${r.pick.id}: ${r.p.error.message}`);
      continue;
    }
    projects.push(r.p.value);
  }
  if (projects.length === 0)
    return err(
      'verification_failed',
      'No project could be written. Check your projects in the Projects tab.',
    );

  deps.emit?.({ type: 'progress', stage: 'verify', message: 'Checking every bullet' });
  const failures = runChecks({ projects }, { entries });
  const bad = new Set(failures.map((f) => f.bulletId));
  for (const p of projects)
    for (const b of p.bullets as Bullet[]) {
      if (bad.has(b.id) && !b.id.includes('.f'))
        Object.assign(b, {
          status: 'failed' as const,
          failures: failures.filter((f) => f.bulletId === b.id).map((f) => f.message),
        });
    }
  trace.record('verify', `${failures.length} failures after retries`);

  deps.emit?.({ type: 'progress', stage: 'summary', message: 'Tailoring summary, skills and experience' });
  let tailored;
  try {
    const corpus = input.corpus ?? '';
    tailored = await tailorResume(
      deps,
      job.value,
      input.profile,
      corpus,
      projects,
      input.meta.projects.flatMap((p) => p.stackVerified),
    );
  } catch {
    return err(
      cancelled() ? 'cancelled' : 'provider_auth',
      cancelled() ? 'The run was cancelled.' : 'The provider rejected the API key.',
    );
  }
  const draft: ResumeDraft = {
    summary: tailored.summary,
    skills: tailored.skills,
    projects,
    gaps: [],
    experience: tailored.experience,
    certifications: input.profile.certifications,
    order: input.order,
  };
  const evidence = [
    ...projects.flatMap((p) => p.stack),
    ...input.profile.skills.flatMap((g) => g.items),
    ...input.meta.index.flatMap((c) => c.kw),
  ];
  const coverage = coverageReport(draft, job.value, evidence);
  draft.gaps = coverage.gaps;
  return ok({ job: job.value, picks: ranked.value, draft, coverage, notes: tailored.notes, trace });
}
